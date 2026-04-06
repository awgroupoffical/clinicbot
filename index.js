require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const express = require('express');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const client = new Anthropic.default({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const clinicConfig = {
  name: "Al Shifa Clinic",
  doctors: ["Dr. Ahmed", "Dr. Sara", "Dr. Ali"],
  hours: "Monday to Saturday, 9am to 6pm",
  location: "Main Boulevard, Lahore",
  phone: "+92-300-1234567",
  primaryColor: "#2ECC71",
  adminEmail: process.env.EMAIL_USER
};

const bookings = [];
const conversations = {};

async function sendEmailNotification(bookingData) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: `New Appointment - ${clinicConfig.name}`,
      html: `
        <h2>New Appointment!</h2>
        <p><b>Patient:</b> ${bookingData.patientName}</p>
        <p><b>Phone:</b> ${bookingData.phone}</p>
        <p><b>Doctor:</b> ${bookingData.doctor}</p>
        <p><b>Date:</b> ${bookingData.date}</p>
        <p><b>Time:</b> ${bookingData.time}</p>
        <p><b>Booked At:</b> ${new Date().toLocaleString()}</p>
      `
    });
    console.log('Email sent!');
  } catch (err) {
    console.log('Email error:', err.message);
  }
}

function isSlotBooked(doctor, date, time) {
  return bookings.some(b =>
    b.doctor === doctor &&
    b.date === date &&
    b.time === time
  );
}

async function chat(userId, userMessage) {
  if (!conversations[userId]) {
    conversations[userId] = [];
  }
  conversations[userId].push({ role: "user", content: userMessage });

  const bookedSlots = bookings.map(b =>
    `${b.doctor} - ${b.date} at ${b.time}`
  ).join('\n') || 'None';

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `You are a professional clinic receptionist for ${clinicConfig.name}.
Clinic Info:
- Doctors: ${clinicConfig.doctors.join(', ')}
- Hours: ${clinicConfig.hours}
- Location: ${clinicConfig.location}
- Phone: ${clinicConfig.phone}

ALREADY BOOKED SLOTS:
${bookedSlots}

Rules:
- Always speak in professional English
- Never give medical advice
- If slot already booked, suggest another time
- When booking confirmed, include EXACTLY:
  BOOKING_CONFIRMED:patientName|phone|doctor|date|time`,
    messages: conversations[userId]
  });

  const assistantMessage = response.content[0].text;

  if (assistantMessage.includes('BOOKING_CONFIRMED:')) {
    const bookingLine = assistantMessage.match(/BOOKING_CONFIRMED:([^\n]+)/);
    if (bookingLine) {
      const parts = bookingLine[1].split('|');
      const bookingData = {
        patientName: parts[0],
        phone: parts[1],
        doctor: parts[2],
        date: parts[3],
        time: parts[4],
        bookedAt: new Date().toLocaleString()
      };
      if (!isSlotBooked(bookingData.doctor, bookingData.date, bookingData.time)) {
        bookings.push(bookingData);
        sendEmailNotification(bookingData);
      }
    }
  }

  const cleanMessage = assistantMessage.replace(/BOOKING_CONFIRMED:[^\n]+/g, '').trim();
  conversations[userId].push({ role: "assistant", content: cleanMessage });
  return cleanMessage;
}

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>${clinicConfig.name}</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;background:#f0f2f5;display:flex;justify-content:center;align-items:center;min-height:100vh}
    .chat-container{width:400px;height:600px;background:white;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.15);display:flex;flex-direction:column;overflow:hidden}
    .chat-header{background:${clinicConfig.primaryColor};color:white;padding:16px 20px}
    .chat-header h2{font-size:18px}
    .chat-header p{font-size:12px;opacity:.9;margin-top:2px}
    .chat-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
    .message{max-width:80%;padding:10px 14px;border-radius:12px;font-size:14px;line-height:1.4}
    .message.bot{background:#f0f2f5;color:#333;align-self:flex-start;border-bottom-left-radius:4px}
    .message.user{background:${clinicConfig.primaryColor};color:white;align-self:flex-end;border-bottom-right-radius:4px}
    .chat-input{padding:12px 16px;border-top:1px solid #eee;display:flex;gap:8px}
    .chat-input input{flex:1;padding:10px 14px;border:1px solid #ddd;border-radius:24px;outline:none;font-size:14px}
    .chat-input button{background:${clinicConfig.primaryColor};color:white;border:none;padding:10px 18px;border-radius:24px;cursor:pointer;font-size:14px}
  </style>
</head>
<body>
  <div class="chat-container">
    <div class="chat-header">
      <h2>🏥 ${clinicConfig.name}</h2>
      <p>Online • 24/7 Appointment Service</p>
    </div>
    <div class="chat-messages" id="messages">
      <div class="message bot">Hello! Welcome to ${clinicConfig.name}. I am your AI receptionist. How can I help you today?</div>
    </div>
    <div class="chat-input">
      <input type="text" id="userInput" placeholder="Type your message..." onkeypress="if(event.key==='Enter')sendMessage()"/>
      <button onclick="sendMessage()">Send</button>
    </div>
  </div>
  <script>
    const userId='user_'+Math.random().toString(36).substr(2,9);
    async function sendMessage(){
      const input=document.getElementById('userInput');
      const msg=input.value.trim();
      if(!msg)return;
      addMessage(msg,'user');
      input.value='';
      const r=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,message:msg})});
      const d=await r.json();
      addMessage(d.reply,'bot');
    }
    function addMessage(text,type){
      const div=document.createElement('div');
      div.className='message '+type;
      div.textContent=text;
      const msgs=document.getElementById('messages');
      msgs.appendChild(div);
      msgs.scrollTop=msgs.scrollHeight;
    }
  </script>
</body>
</html>`);
});

app.post('/chat', async (req, res) => {
  try {
    const { userId, message } = req.body;
    const reply = await chat(userId, message);
    res.json({ reply });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ reply: 'Sorry, something went wrong.' });
  }
});

app.get('/bookings', (req, res) => {
  res.json(bookings);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ClinicBot running on port ${PORT}`);
});