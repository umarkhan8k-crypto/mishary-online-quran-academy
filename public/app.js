document.getElementById('trialForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    const bookingData = {
        studentName: document.getElementById('studentName').value,
        age: document.getElementById('studentAge').value,
        tutorId: document.getElementById('tutorSelect').value,
        course: document.getElementById('courseSelect').value,
        preferredTime: document.getElementById('preferredTime').value,
        message: document.getElementById('message').value
    };

    try {
        const response = await fetch('/api/book-trial', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingData)
        });

        const result = await response.json();
        
        if (response.ok) {
            alert('Booking successful! A notification message has been sent to your selected tutor.');
            // اکاؤنٹ بننے/بکنگ کے بعد پروفائل پر ری ڈائریکٹ کرنا
            window.location.href = 'profile.html';
        } else {
            alert(result.error || 'Something went wrong!');
        }
    } catch (err) {
        console.error('Error:', err);
        alert('Failed to connect to server.');
    }
});
