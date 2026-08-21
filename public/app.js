document.addEventListener('DOMContentLoaded', () => {
    const trialForm = document.getElementById('trialForm');
    
    if (trialForm) {
        trialForm.addEventListener('submit', async (e) => {
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
                    alert('Trial booked successfully! A message has been sent to your selected tutor.');
                    // بکنگ اور میسج کے بعد سٹوڈنٹ پروفائل پر ری ڈائریکٹ کرنا
                    window.location.href = 'profile.html';
                } else {
                    alert(result.error || 'Failed to book trial. Please try again.');
                }
            } catch (err) {
                console.error('Network Error:', err);
                alert('An error occurred. Please check your connection.');
            }
        });
    }
});
