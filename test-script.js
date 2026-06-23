const targetUrl = 'http://localhost:3000/payment';

// We create an array of 5 identical requests
const requests = [];

for (let i = 0; i < 10; i++) {
    requests.push(
        fetch(targetUrl, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                
            },
            body: JSON.stringify({
                amount: 1000,
                idempotencyKey: "race-condition-key-011"
            })
        }).then(async (response) => {
            const data = await response.json();
            console.log(`Status: ${response.status} | Response:`, data);
        })
    );
}

console.log("Firing 5 concurrent requests at the exact same time...");

// Promise.all fires every request in the array simultaneously
Promise.all(requests).then(() => {
    console.log("Race test complete.");
});