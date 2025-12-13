// src/ChatBot.jsx
import { useState, useEffect, useRef } from 'react';
import './ChatBot.css';

const KNOWLEDGE_BASE = {
  default: "I can help with emergency contacts. Try asking for 'Police', 'Ambulance', 'Flood', 'Fire', or 'Hospital'.",
  police: "🚓 Police Emergency: 119 \nPolice HQ: 011-2421111",
  ambulance: "🚑 Suwa Seriya Ambulance: 1990",
  fire: "🔥 Fire & Rescue: 110",
  flood: "🌊 Disaster Management Center (DMC): 117 \nNavy Rescue: 011-2445368",
  electricity: "⚡ CEB Breakdown: 1987 \nLECO: 1910",
  hospital: "🏥 National Hospital Colombo: 011-2691111",
  bomb: "💣 Bomb Disposal: 011-2433335",
  tourism: "Tourist Police: 011-2421052"
};

export default function ChatBot({ onClose }) {
  const [messages, setMessages] = useState([
    { id: 1, text: "Hi! I am your offline assistant. Need emergency numbers? Type 'Police', 'Ambulance', or 'Flood'.", sender: 'bot' }
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { id: Date.now(), text: input, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    
    // Process Response (Simple Keyword Matching)
    const lowerInput = input.toLowerCase();
    let botResponse = KNOWLEDGE_BASE.default;

    if (lowerInput.includes('police') || lowerInput.includes('cop')) botResponse = KNOWLEDGE_BASE.police;
    else if (lowerInput.includes('ambulance') || lowerInput.includes('medic') || lowerInput.includes('1990')) botResponse = KNOWLEDGE_BASE.ambulance;
    else if (lowerInput.includes('fire')) botResponse = KNOWLEDGE_BASE.fire;
    else if (lowerInput.includes('flood') || lowerInput.includes('rain') || lowerInput.includes('disaster')) botResponse = KNOWLEDGE_BASE.flood;
    else if (lowerInput.includes('power') || lowerInput.includes('light') || lowerInput.includes('electricity')) botResponse = KNOWLEDGE_BASE.electricity;
    else if (lowerInput.includes('hospital') || lowerInput.includes('doctor')) botResponse = KNOWLEDGE_BASE.hospital;
    else if (lowerInput.includes('bomb')) botResponse = KNOWLEDGE_BASE.bomb;

    setTimeout(() => {
      setMessages(prev => [...prev, { id: Date.now() + 1, text: botResponse, sender: 'bot' }]);
    }, 500);

    setInput("");
  };

  return (
    <div className="chatbot-window">
      <div className="chatbot-header">
        <h4>🤖 SL Emergency Bot</h4>
        <button onClick={onClose} className="close-chat">✕</button>
      </div>
      <div className="chatbot-body">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.sender}`}>
            {msg.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form className="chatbot-footer" onSubmit={handleSend}>
        <input 
          type="text" 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder="Type 'Police'..." 
        />
        <button type="submit">➤</button>
      </form>
    </div>
  );
}