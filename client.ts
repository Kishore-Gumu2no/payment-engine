fetch("http://localhost:3000/payment", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(
        {amount: 100,
        idempotencyKey: "Key-1434"
        })
})
.then(response => response.json())
.then(data => console.log("Server replied:", data));