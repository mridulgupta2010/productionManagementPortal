const dropArea = document.querySelector(".drag-image"),
dragText = dropArea.querySelector("h6"),
button = dropArea.querySelector("button"),
input = dropArea.querySelector("input"),
form = document.querySelector("#uploadForm");
let file; 

button.onclick = () => {
  input.click(); 
}

input.addEventListener("change", function() {
  file = this.files[0];
  dropArea.classList.add("active");
  viewfile();
});

dropArea.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropArea.classList.add("active");
  dragText.textContent = "Release to Upload File";
});

dropArea.addEventListener("dragleave", () => {
  dropArea.classList.remove("active");
  dragText.textContent = "Drag & Drop to Upload File";
}); 

dropArea.addEventListener("drop", (event) => {
  event.preventDefault(); 
  file = event.dataTransfer.files[0];
  viewfile(); 
});

function viewfile() {
  let fileType = file.type; 
  if (["text/csv", "application/vnd.ms-excel"].includes(fileType)) { 
    let submitBtn = `<button type="submit" class="upload-btn">Upload CSV</button>`;
    dropArea.innerHTML = submitBtn; 
  } else {
    alert("This is not a CSV File!");
    dropArea.classList.remove("active");
    dragText.textContent = "Drag & Drop to Upload File";
  }
}

form.addEventListener('submit', function(e) {
    e.preventDefault(); 

    if (!file || !["text/csv", "application/vnd.ms-excel"].includes(file.type)) {
        alert('Please select a valid CSV file to upload');
        return;
    }

    let formData = new FormData(this);
    formData.append('csvfile', file);

    fetch('/', {
        method: 'POST',
        body: formData
    })
    .then(response => response.text())
    .then(data => {
        console.log(data); // Handle the response from the server
    })
    .catch(error => {
        console.error('Error:', error);
    });
});