const express = require('express');
const router = express.Router();

const User = require('./../models/User')

const bcrypt = require('bcrypt');

router.post("/signup", (req,res) => {
    console.log(req.body);
    let {fName, lName, email, password} = req.body;

    fName = fName.trim();
    lName = lName.trim();
    email = email.trim();
    password = password.trim();
    userName = fName + lName;

    if(fName=="" || lName == "" || email == "" || password == "") {
        res.json({
            status: "Failed",
            message: "Empty input fields!"
        })
    } else if(!/^[a-zA-Z]*$/.test(fName) || !/^[a-zA-Z]*$/.test(lName)) {
        res.json({
            status: "Failed",
            message: "Invalid name entered!"
        })
    } else {
        User.find({email}).then(result => {

            if(result.length){
                res.json({
                    status: "Failed",
                    message: "User with provided email already exists!"
                })
            } else {
                // Create new user
                    
                //Handle password
                const saltRounds = 10;
                bcrypt.hash(password,saltRounds).then(hashedPassword => {

                    const newUser = new User({
                        userName,
                        userFirstName: fName,
                        userLastName: lName,
                        email,
                        password: hashedPassword
                    })

                    newUser.save().then(result => {
                        res.json({
                            status: "Success",
                            message: "Signup successfull!",
                            data: result
                        })
                    }).catch(err => {
                        res.json({
                            status: "Failed",
                            message: "An error occured while saving password!"
                        })
                    })

                }).catch(err => {
                    console.log(err);
                    res.json({
                        status: "Failed",
                        message: "An error occured while hashing password"
                    })
                })
            }

        }).catch(err=> {
            console.log(err);
            res.json({
                status: "Failed",
                message: "An error occured while checking for existing user!"
            })
        })
    }
})

router.post("/signin", async (req,res) => {

    console.log(req.body);
    let {email, password} = req.body;
    email = email.trim();
    password = password.trim();

    if(email == "" || password == "") {
        res.json({
            status: "Failed",
            message: "Empty credential supplied!"
        })
    } else {
        

        try {
            const data = await User.find({email});
            if (data) {
                //User exists
                console.log(data)
                const hashedPassword = data[0].password;
                bcrypt.compare(password, hashedPassword).then(result => {
                    if(result) {

                        res.json({
                            status: "SUCCESS",
                            message: "Sign in successfull!",
                            data: data
                        })
                        
                    } else {
                        res.json({
                            status: "Failed",
                            message: "Invalid password entered!"
                        })
                    }
                }).catch(err =>{
                    console.log(err);
                    res.json({
                        status: "Failed",
                        message: "Error while comparing passwords!"
                    })
                })
            }
        } catch(err) {
            console.log(err);
                    res.json({
                        status: "Failed",
                        message: "Error while checking username!"
                    })
        }
    }

})

module.exports = router;