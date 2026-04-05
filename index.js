require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const express = require('express');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const client = new Anthropic.default({ 
  apiKey: process.env.ANTHROPIC_API_KEY 
});

// Clinic Config - har client ke liye yeh badlo!
const clinicConfig = {
  name: "Al Shifa Clinic",
  doctors: ["Dr. Ahmed", "Dr. Sara", "Dr. Ali"],
  hours: "Monday to Saturday, 9am to 6pm",
  location: "Main Boulevard, Lahore",
  phone: "+92-300-1234567",
  primaryColor: "#2ECC71",
  language: "Urdu/English"
};

// Conversation history store
const conversations = {};

async function chat(userId, userMessage) {
  if (!conversations[userId]) {
    conversations[userId] = [];
  }

  conversations[userId].push({
    role: "user",
    content: userMessage
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `You are a friendly clinic receptionist for ${clinicConfig.name}. 
    
Your job:
1. Help patients book appointments
2. Answer questions about the clinic
3. Handle rescheduling and cancellations
4. Send reminders

Clinic Info:
- Doctors: ${clinicConfig.doctors.join(', ')}
- Hours: ${clinicConfig.hours}
- Location: ${clinicConfig.location}
- Phone: ${clinicConfig.phone}

Rules:
- Always be polite and friendly
- Speak in Urdu/English mix (Hinglish style)
- Never give medical advice
- Always confirm appointments by repeating details
- If emergency, ask to call 1122

When booking ask: Patient name, preferred doctor, preferred date and time.`,
    messages: conversations[userId]
  });

  const assistantMessage = response.content[0].text;
  
  conversations[userId].push({
    role: "assistant", 
    content: assistantMessage
  });

  return assistantMessage;
}

// Web Widget endpoint
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>${clinicConfig.name} - Chat</title>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #f0f2f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .chat-container { width: 400px; height: 600px; background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); display: flex; flex-direction: column; overflow: hidden; }
    .chat-header { background: ${clinicConfig.primaryColor}; color: white; padding: 16px 20px; }
    .chat-header h2 { font-size: 18px; }
    .chat-header p { font-size: 12px; opacity: 0.9; margin-top: 2px; }
    .chat-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
    .message { max-width: 80%; padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.4; }
    .message.bot { background: #f0f2f5; color: #333; align-self: flex-start; border-bottom-left-radius: 4px; }
    .message.user { background: ${clinicConfig.primaryColor}; color: white; align-self: flex-end; border-bottom-right-radius: 4px; }
    .chat-input { padding: 12px 16px; border-top: 1px solid #eee; display: flex; gap: 8px; }
    .chat-input input { flex: 1; padding: 10px 14px; border: 1px solid #ddd; border-radius: 24px; outline: none; font-size: 14px; }
    .chat-input button { background: ${clinicConfig.primaryColor}; color: white; border: none; padding: 10px 18px; border-radius: 24px; cursor: pointer; font-size: 14px; }
    .typing { color: #999; font-size: 13px; padding: 4px 8px; }
  </style>
</head>
<body>
  <div class="chat-container">
    <div class="chat-header">
      <h2>🏥 ${clinicConfig.name}</h2>
      <p>Online • 24/7 Appointment Service</p>
    </div>
    <div class="chat-messages" id="messages">
      <div class="message bot">Assalam o Alaikum! 👋 Main ${clinicConfig.name} ka AI receptionist hun. Appointment book karni hai ya koi sawaal hai?</div>
    </div>
    <div class="chat-input">
      <input type="text" id="userInput" placeholder="Apna message likhein..." onkeypress="if(event.key==='Enter') sendMessage()"/>
      <button onclick="sendMessage()">Send</button>
    </div>
  </div>
  <script>
    const userId = 'user_' + Math.random().toString(36).substr(2, 9);
    async function sendMessage() {
      const input = document.getElementById('userInput');
      const msg = input.value.trim();
      if (!msg) return;
      addMessage(msg, 'user');
      input.value = '';
      const typing = document.createElement('div');
      typing.className = 'typing';
      typing.id = 'typing';
      typing.textContent = 'Receptionist likh raha hai...';
      document.getElementById('messages').appendChild(typing);
      scrollToBottom();
      const response = await fetch('/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ userId, message: msg })
      });
      const data = await response.json();
      document.getElementById('typing')?.remove();
      addMessage(data.reply, 'bot');
    }
    function addMessage(text, type) {
      const div = document.createElement('div');
      div.className = 'message ' + type;
      div.textContent = text;
      document.getElementById('messages').appendChild(div);
      scrollToBottom();
    }
    function scrollToBottom() {
      const msgs = document.getElementById('messages');
      msgs.scrollTop = msgs.scrollHeight;
    }
  </script>
</body>
</html>
  `);
});

// Chat API
app.post('/chat', async (req, res) => {
  try {
    const { userId, message } = req.body;
    const reply = await chat(userId, message);
    res.json({ reply });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ reply: 'Sorry, kuch masla aa gaya. Dobara try karein.' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════╗
║   ClinicBot AI Agent - Running!   ║
║   ${clinicConfig.name}            ║
║   Open: http://localhost:3000     ║
╚════════════════════════════════════╝
  `);
});