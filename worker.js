// worker.js کے اندر ہینڈلر میں یہ کوڈ شامل کریں:
if (url.pathname === '/api/book-trial' && request.method === 'POST') {
    try {
        const data = await request.json();
        
        // یہاں آپ ڈیٹا بیس (D1 یا KV) میں ٹرائل اور ٹیوٹر کے میسج کو سیو کرنے کی کمانڈ لکھ سکتے ہیں
        // مثال کے طور پر:
        // await env.DB.prepare("INSERT INTO messages (tutor_id, student_name, course, message, time) VALUES (?, ?, ?, ?, ?)").bind(data.tutorId, data.studentName, data.course, data.message, data.preferredTime).run();

        return new Response(JSON.stringify({ success: true, message: "Trial booked and message sent to tutor!" }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}


