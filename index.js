// require('./config/db'); const UserRouter = require('./api/User');
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const encrypt = require("mongoose-encryption");
const session = require("express-session");
const mongoStore = require("connect-mongo");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const nodemailer = require("nodemailer");
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const port = 3000;


const mailgun = new Mailgun(formData);
const mg = mailgun.client({username: 'api', key: process.env.MAILGUN_API_KEY});
async function sendMail(to, subject, resetURL) {
    try {
        const htmlContent = `<p>Please click on the following link to reset your password: <a href='${resetURL}'>${resetURL}</a></p>`;

        const msg = await mg.messages.create(process.env.MAILGUN_DOMAIN, {
            from: "Your Name <mailgun@" + process.env.MAILGUN_DOMAIN + ">",
            to: [to],
            subject: subject,
            html: htmlContent
        });

        console.log("Email sent:", msg);
    } catch (error) {
        console.error("Failed to send email:", error);
    }
}

//Create an express server
const app = express();
const upload = multer({dest: 'axUploads/'});
//Initialize session middleware
app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    store: mongoStore.create({
        mongoUrl: process.env.DB_URL,
        ttl: 4 * 60 * 60
    })
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

app.use(function (req, res, next) {
    if (!(req.path === '/login' || req.path.startsWith('/auth/')) && req.session.returnTo) {
        delete req.session.returnTo;
    }
    next();
});

app.use(express.static("public"));
app.set('view engine', 'ejs');
// For JSON bodies
app.use(express.json());
app.use(bodyParser.urlencoded({extended: true}));

//Create a mongoose connection
mongoose.connect(process.env.DB_URL, {useNewUrlParser: true});

const userSchema = new mongoose.Schema(
    {userFirstName: String, userLastName: String, username: String, password: String, userID: String}
)

// Inside userSchema definition
userSchema.add({
    resetPasswordToken: String,
    resetPasswordExpires: Date,
  });

const orderSchema = new mongoose.Schema({
    orderId: String,
    customerName: String,
    dispatchDate: Date,
    orderStatus: String,
    orderNotes: String,
    orderItems: [
        {
            partNumber: String,
            quantity: Number
        }
    ]
});

const dashboardSchema = new mongoose.Schema({
    newOrders: Number,
    allOrdersBefore: Number,
    allOrdersafter: Number,
});

userSchema.plugin(passportLocalMongoose);
const User = new mongoose.model("axProduction", userSchema);
const Order = mongoose.model('axOrders', orderSchema);

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Middleware to check if the user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }

    req.session.returnTo = req.originalUrl;
    console.log(req.originalUrl);
    res.redirect(`/`);
};

app.get("/", function (req, res) {
    // if (req.isAuthenticated()) {      If the user is authenticated, render the
    // dashboard     res.render("dashboard", { user: req.user}); } else { If the
    // user is not authenticated, render the login page
    res.render("login");
    // }
});

app.get("/upload", function (req, res) {

    res.render("upload");
});


app.post('/upload-csv', upload.single('csvfile'), async (req, res) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const filePath = req.file.path;
        const groupedItems = {};
        const csvOrderIds = new Set();

        await new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .pipe(csvParser())
                .on('data', (data) => {
                    const orderId = data.SalesId;
                    csvOrderIds.add(orderId);

                    if (!groupedItems[orderId]) {
                        groupedItems[orderId] = {
                            customerName: data.CustName, // Keep for new orders
                            dispatchDate: new Date(data.DlvDate1),
                            orderItems: []
                        };
                    }

                    groupedItems[orderId].orderItems.push({
                        partNumber: data.ItemId,
                        quantity: parseInt(data.SalesQty, 10)
                    });
                })
                .on('end', () => resolve())
                .on('error', (error) => reject(error));
        });

        // Retrieve all orders for comparison
        const existingOrders = await Order.find({ orderId: { $in: Array.from(csvOrderIds) } }).session(session);

        for (const orderId of Object.keys(groupedItems)) {
            const { dispatchDate, orderItems } = groupedItems[orderId];
            const existingOrder = existingOrders.find(order => order.orderId === orderId);

            if (existingOrder) {
                // Update existing order - only dispatchDate and orderItems
                await Order.updateOne({ orderId }, {
                    $set: { dispatchDate, orderItems }
                }, { session });
            } else {
                // Insert new order - use full details from groupedItems
                const newOrderData = groupedItems[orderId];
                const newOrder = new Order({ ...newOrderData, orderId });
                await newOrder.save({ session });
            }
        }

        // Delete orders not present in the new CSV
        const allOrders = await Order.find({});
        const ordersToDelete = allOrders
            .filter(order => !csvOrderIds.has(order.orderId))
            .map(order => order.orderId);

        if (ordersToDelete.length) {
            await Order.deleteMany({ orderId: { $in: ordersToDelete } }).session(session);
        }

        await session.commitTransaction();
        res.redirect("/dashboard");
    } catch (err) {
        console.error("Error during file upload and processing:", err);
        res.render("upload", { message: "File upload failed!", tip: "Please check your date format and ensure data is correct." });
    } finally {
        session.endSession();
        fs.unlinkSync(req.file.path); // Ensure file is deleted even if there's an error.
    }
});

// app.post('/upload-csv', upload.single('csvfile'), async (req, res) => {
//     const results = {}; // Use an object instead of an array

//     fs.createReadStream(req.file.path)
//       .pipe(csvParser())
//       .on('data', (data) => {
//         const orderId = data.SalesId;
//         const newItem = {
//             partNumber: data.ItemId,
//             quantity: parseInt(data.SalesQty, 10)
//         };

//         if (!results[orderId]) {
//           results[orderId] = {
//               orderId: data.SalesId,
//               customerName: data.CustName,
//               dispatchDate: new Date(data.DlvDate1),
//               orderStatus:"In progress",
//               orderNotes:"This is a note.", // Adjust the date format as needed
//               orderItems: []
//           };
//         }

//         results[orderId].orderItems.push(newItem);
//       })
//       .on('end', async () => {
//         try {
//           for (const orderId in results) {
//             if (results.hasOwnProperty(orderId)) {
//               const item = results[orderId];
//               await Order.updateOne(
//                 { orderId: item.orderId },
//                 { $set: { customerName: item.customerName, dispatchDate: item.dispatchDate, orderStatus: item.orderStatus, orderNotes: item.orderNotes },
//                   $push: { orderItems: { $each: item.orderItems } } },
//                 { upsert: true }
//               );
//             }
//           }
//           res.send('Successfully uploaded and stored data!');
//           fs.unlinkSync(req.file.path); // Clean up the uploaded file
//         } catch (err) {
//           res.status(500).send('Error inserting data into MongoDB: ' + err);
//         }
//       });
// });

app.get("/logout", function (req, res) {

    req.logout(function (err) {
        if (err) {
            console.error("Error logging out:", err);
        } else {
            res.redirect("/");
        }

    })
});

app.get("/dashboard", isAuthenticated, async function (req, res) {
    try {
        const orders = await Order.find({}); // Fetch all orders
        res.render("dashboard", { user: req.user, orders: orders }); // Pass orders to the EJS template
    } catch (err) {
        console.error("Error fetching orders:", err);
        res.status(500).send("Error retrieving orders from the database.");
    }
});

app.post("/", function (req, res, next) {

    passport.authenticate('local', function (err, user, info) {
        // Error from Passport middleware
        if (err) {
            console.error("Passport authentication error:", err);
            return next(err); // Pass to error handler
        }
        // No user found or wrong password
        if (!user) {
            console.log("Login failed, user not found or wrong password");
            return res.render("login", {message: "Invalid credentials. Please try again."});
        }
        // Successfully authenticated, proceed to log the user in
        req.logIn(user, function (err) {
            if (err) {
                console.error("Error logging in:", err);
                return next(err); // Pass to error handler
            }
            console.log("Login successful");

            // Redirect the user to the desired page after login
            const redirectTo = req.session.returnTo || '/dashboard';
            delete req.session.returnTo;
            return res.redirect(redirectTo);
        });
    })(req, res, next); // These are required to make the `passport.authenticate` middleware work inside the route handler
});

app.post("/signup", (req, res, next) => { // Include 'next' here
    console.log(req.body);
    let fName = req.body.fName;
    let lName = req.body.lName;
    let email = req.body.username;

    if (fName == "" || lName == "" || email == "" || req.body.password == "") {
        res.json({status: "Failed", message: "Empty input fields!"});
    } else if (!/^[a-zA-Z]*$/.test(fName) || !/^[a-zA-Z]*$/.test(lName)) {
        res.json({status: "Failed", message: "Invalid name entered!"});
    } else {
        User
            .findOne({email})
            .then(result => {
                if (result) {
                    res.json(
                        {status: "Failed", message: "User with provided email already exists!"}
                    );
                } else {
                    // Create new user
                    User.register({
                        userFirstName: fName,
                        userLastName: lName,
                        username: req.body.username
                    }, req.body.password, function (err, user) {
                        if (err) {
                            console.log(err);
                            res.json({status: "Failed", message: "Error occurred while adding a user!"});
                        } else {
                            passport.authenticate('local')(req, res, function () {
                                // Redirect or respond here after successful login
                                return res.redirect('/dashboard');
                            });
                        }
                    });
                }
            })
            .catch(err => {
                console.log(err);
                res.json(
                    {status: "Failed", message: "An error occurred while checking for existing user!"}
                );
            });
    }
});

app.post('/updateOrder', async (req, res) => {
    const { orderId, comments, status } = req.body;
    try {
        await Order.findOneAndUpdate(
            { orderId: orderId },
            {
                $set: {
                    orderNotes: comments,
                    orderStatus: status,
                }
            }
        );
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).send('Error updating order.');
    }
});

app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ username: email });

    if (!user) {
        return res.status(404).send('User not found.');
    }

    user.resetPasswordToken = require('crypto').randomBytes(20).toString('hex');
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

    await user.save();

    const resetURL = `http://${req.headers.host}/reset/${user.resetPasswordToken}`;

    await sendMail(user.username, 'Password Reset Request', resetURL);

    res.render('login', {message: "Verification link has been sent to your email."});
  });


app.get('/reset/:token', async (req, res) => {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() },
    });
  
    if (!user) {
      return res.status(400).send('Password reset token is invalid or has expired.');
    }
  
    // Render your password reset form here
    res.render('resetPassword', { token: req.params.token });
  });
  
  app.post('/reset/:token', async (req, res) => {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() },
    });
  
    if (!user) {
      return res.status(400).send('Password reset token is invalid or has expired.');
    }
  
    if (req.body.password === req.body.confirm) {
      user.setPassword(req.body.password, async (err) => {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
  
        await user.save();
        req.login(user, (err) => {
            res.redirect('/');
        });
      });
    } else {
      res.redirect('/');
    }
  });


app.listen(process.env.PORT ||port, () => {
    console.log(`Server running on ${port}`)
})

