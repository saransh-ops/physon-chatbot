import React, { useState, useEffect, useRef, useCallback } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import './Chat.css';

marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: true,
  gfm: true
});

function Chat({ token, user, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('llama-3.3-70b-versatile');
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [weather, setWeather] = useState(null);
  const [weatherCity, setWeatherCity] = useState('');
  const [showWeather, setShowWeather] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [toast, setToast] = useState(null);
  const messagesEndRef = useRef(null);

  const models = [
    { id: 'llama-3.3-70b-versatile', name: 'llama-3.3-70b' },
  ];

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const loadConversations = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/conversations`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.conversations) {
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }, [token]);

  const createNewConversation = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/conversations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: 'New Conversation' })
      });
      const data = await response.json();
      setCurrentConversationId(data.id);
      setMessages([]);
      loadConversations();
      showToast('✨ New conversation started');
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const loadConversation = async (conversationId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/conversations/${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.messages) {
        setMessages(data.messages.map(m => ({ role: m.role, content: m.content })));
        setCurrentConversationId(conversationId);
        setShowHistory(false);
        showToast('💬 Conversation loaded');
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const deleteConversation = async (conversationId) => {
    if (!window.confirm('Delete this conversation?')) return;

    try {
      await fetch(`${process.env.REACT_APP_API_URL}/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (currentConversationId === conversationId) {
        setMessages([]);
        setCurrentConversationId(null);
      }
      
      loadConversations();
      showToast('🗑️ Conversation deleted');
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const fetchWeather = async () => {
    if (!weatherCity.trim()) {
      showToast('❌ Please enter a city name');
      return;
    }

    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/weather?city=${encodeURIComponent(weatherCity)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch weather');
      }
      
      setWeather(data.weather);
      showToast('🌤️ Weather updated');
    } catch (error) {
      showToast(`❌ ${error.message}`);
    }
  };

  const sendMessage = async (text = inputValue) => {
    if (!text.trim() || isLoading) return;

    // Create conversation if none exists
    let convId = currentConversationId;
    if (!convId) {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/conversations`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title: 'New Conversation' })
        });
        const data = await response.json();
        convId = data.id;
        setCurrentConversationId(convId);
      } catch (error) {
        console.error('Error creating conversation:', error);
        showToast('❌ Failed to create conversation');
        return;
      }
    }

    const userMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages,
          model: selectedModel,
          conversationId: convId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = { role: 'assistant', content: '' };
      setMessages(prev => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                assistantMessage.content += parsed.content;
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1] = { ...assistantMessage };
                  return newMsgs;
                });
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      // Reload conversations to get updated title
      loadConversations();
    } catch (error) {
      console.error('Error:', error);
      showToast('❌ Failed to send message');
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyMessage = (content) => {
    navigator.clipboard.writeText(content);
    showToast('📋 Copied to clipboard');
  };

  const exportChat = () => {
    const chatText = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${Date.now()}.txt`;
    a.click();
    showToast('💾 Chat exported');
  };

  const renderMessage = (content) => {
    const html = marked.parse(content);
    return { __html: html };
  };

  return (
    <div className="chat-page">
      {/* Sidebar */}
      <div className={`sidebar ${showHistory ? 'show' : ''}`}>
        <div className="sidebar-header">
          <h3>💬 Conversations</h3>
          <button className="icon-btn" onClick={() => setShowHistory(false)}>✕</button>
        </div>
        
        <button className="new-chat-btn" onClick={createNewConversation}>
          ➕ New Chat
        </button>

        <div className="conversations-list">
          {conversations.map((conv) => (
            <div key={conv.id} className="conversation-item">
              <div className="conv-info" onClick={() => loadConversation(conv.id)}>
                <span className="conv-title">{conv.title}</span>
                <span className="conv-date">
                  {new Date(conv.updated_at).toLocaleDateString()}
                </span>
              </div>
              <button 
                className="delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(conv.id);
                }}
              >
                🗑️
              </button>
            </div>
          ))}
          
          {conversations.length === 0 && (
            <div className="empty-state">
              <p>No conversations yet</p>
              <p>Start chatting to create one!</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="chat-main">
        <div className="chat-header">
          <div className="header-left">
            <button className="menu-btn" onClick={() => setShowHistory(!showHistory)}>
              ☰
            </button>
            <h1>🤖 AI Chatbot</h1>
          </div>

          <div className="header-center">
            <select 
              className="model-selector"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {models.map(model => (
                <option key={model.id} value={model.id}>{model.name}</option>
              ))}
            </select>
          </div>

          <div className="header-right">
            <button 
              className="icon-button weather-btn" 
              onClick={() => setShowWeather(!showWeather)}
              title="Weather"
            >
              🌤️
            </button>
            <button className="icon-button" onClick={exportChat} title="Export">💾</button>
            <button className="icon-button" onClick={createNewConversation} title="New Chat">➕</button>
            <div className="user-menu">
              <span className="user-name">{user?.name || user?.email}</span>
              <button className="logout-btn" onClick={onLogout}>Logout</button>
            </div>
          </div>
        </div>

        {/* Weather Panel */}
        {showWeather && (
          <div className="weather-panel">
            <div className="weather-input">
              <input
                type="text"
                placeholder="Enter city name..."
                value={weatherCity}
                onChange={(e) => setWeatherCity(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && fetchWeather()}
              />
              <button onClick={fetchWeather}>Get Weather</button>
            </div>
            
            {weather && (
              <div className="weather-display">
                <div className="weather-main">
                  <img 
                    src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
                    alt={weather.description}
                  />
                  <div>
                    <h3>{weather.city}, {weather.country}</h3>
                    <p className="temp">{weather.temperature}°C</p>
                    <p className="desc">{weather.description}</p>
                  </div>
                </div>
                <div className="weather-details">
                  <div className="detail">
                    <span>Feels like</span>
                    <strong>{weather.feels_like}°C</strong>
                  </div>
                  <div className="detail">
                    <span>Humidity</span>
                    <strong>{weather.humidity}%</strong>
                  </div>
                  <div className="detail">
                    <span>Wind</span>
                    <strong>{weather.wind_speed} m/s</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="welcome-screen">
              <h2>Welcome, {user?.name || 'there'}! 👋</h2>
              <p>Start a conversation with AI</p>
              <div className="suggestion-cards">
                <div className="suggestion-card" onClick={() => sendMessage('Explain quantum computing simply')}>
                  <h3>💡 Explain</h3>
                  <p>Quantum computing</p>
                </div>
                <div className="suggestion-card" onClick={() => sendMessage('Write a creative story')}>
                  <h3>✍️ Write</h3>
                  <p>Creative story</p>
                </div>
                <div className="suggestion-card" onClick={() => sendMessage('Help me code in Python')}>
                  <h3>💻 Code</h3>
                  <p>Python help</p>
                </div>
                <div className="suggestion-card" onClick={() => sendMessage('Brainstorm app ideas')}>
                  <h3>🎯 Brainstorm</h3>
                  <p>App ideas</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div key={index} className={`message ${message.role}-message`}>
                  <div 
                    className="message-content"
                    dangerouslySetInnerHTML={renderMessage(message.content)}
                  />
                  <div className="message-actions">
                    <button onClick={() => copyMessage(message.content)}>📋 Copy</button>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="message assistant-message">
                  <div className="typing-indicator">
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="chat-input-container">
          <div className="input-wrapper">
            <textarea
              className="chat-input"
              placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              rows="1"
            />
            <button 
              className="send-button"
              onClick={() => sendMessage()}
              disabled={isLoading || !inputValue.trim()}
            >
              {isLoading ? '⏳' : '🚀'}
            </button>
          </div>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default Chat;
