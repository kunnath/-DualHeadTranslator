# Shared Room Feature - Troubleshooting Guide

## How the Shared Room Feature Works

### Basic Flow:
1. **User 1 (English)** generates a room code → shares it with **User 2 (German)**
2. **User 2 (German)** enters the same room code
3. Both users click "Start Translation Session"
4. Real-time translation: English ↔ German

---

## Common Issues & Solutions

### 1. **"Unable to Enter Room Code" Issues**

#### **Issue A: Room Code Field Not Editable**
**Problem**: User can't type in the room code field
**Solutions**:
- Click directly in the room code input field
- Clear any existing code first (🗑️ Clear button)
- Try refreshing the page

#### **Issue B: Room Code Format Invalid**
**Problem**: Invalid characters or wrong length
**Solutions**:
- Room codes must be exactly 6 characters
- Only letters (A-Z) and numbers (0-9) allowed
- Code is automatically converted to uppercase

#### **Issue C: Paste Not Working**
**Problem**: Pasting room code doesn't work
**Solutions**:
- Use the "📋 Paste" button instead of Ctrl+V
- Manually type the room code
- Check clipboard has valid 6-character code

### 2. **Connection Issues**

#### **Issue A: Users Can't Connect to Same Room**
**Symptoms**: 
- Room code accepted but users don't see each other
- "1 users connected" instead of "2 users connected"

**Causes & Solutions**:
1. **Different room codes**:
   - Verify both users have EXACTLY the same 6-character code
   - Case doesn't matter (auto-converted to uppercase)

2. **Network/Server issues**:
   - Check if server is running (`npm start`)
   - Refresh both browser pages
   - Check browser console for WebSocket errors

3. **Browser compatibility**:
   - Use Chrome, Firefox, or Safari
   - Enable microphone permissions
   - Ensure HTTPS (required for mic access)

#### **Issue B: One User Connects, Other Doesn't**
**Solutions**:
- Second user should wait 5-10 seconds after first user connects
- Both users refresh and try again
- Check if users selected different languages (one EN, one DE)

### 3. **Language Selection Issues**

#### **Critical Requirement**: 
- **User 1 MUST select English 🇺🇸**
- **User 2 MUST select German 🇩🇪**

**If both select same language**:
- Translation won't work properly
- They'll hear their own language echoed back

### 4. **Audio/Microphone Issues**

#### **Issue A: "Hold to Talk" Button Not Working**
**Causes & Solutions**:
1. **Microphone permissions denied**:
   - Click 🔒 icon in browser address bar
   - Allow microphone access
   - Refresh page

2. **No microphone detected**:
   - Connect headset/microphone before starting
   - Check browser settings → Privacy → Microphone

3. **Browser not supported**:
   - Use Chrome (best), Firefox, or Safari
   - Avoid older browsers or mobile browsers

#### **Issue B: Speech Recognition Not Working**
**Solutions**:
- Speak clearly and loudly
- Check internet connection (needs online STT service)
- Try different microphone
- Ensure selected language matches what you're speaking

### 5. **Translation Issues**

#### **Issue A: No Translation Heard**
**Causes**:
1. **Audio output issues**:
   - Check speaker/headphone volume
   - Test audio with other apps

2. **Translation service down**:
   - Check if Ollama server is running
   - Verify translation API is working

3. **Wrong language flow**:
   - English speaker should hear German
   - German speaker should hear English

---

## Step-by-Step Success Guide

### For English User (User 1):
1. ✅ Open `/dual-headset`
2. ✅ Select **English 🇺🇸** language
3. ✅ Select device type (Headset/Mobile)
4. ✅ Click "🎲 Generate" to create room code
5. ✅ **Share the 6-digit code** with German user (via text, call, etc.)
6. ✅ Click "Start Translation Session"
7. ✅ Wait for German user to join
8. ✅ When you see "2 users connected", start talking!

### For German User (User 2):
1. ✅ Open `/dual-headset`
2. ✅ Select **German 🇩🇪** language  
3. ✅ Select device type (Headset/Mobile)
4. ✅ **Type the 6-digit code** received from English user
5. ✅ Click "Start Translation Session"
6. ✅ When you see "2 users connected", start talking!

---

## Testing the Connection

### Quick Test Process:
1. **English user says**: "Hello, can you hear me?"
2. **German user should hear**: "Hallo, kannst du mich hören?"
3. **German user says**: "Ja, ich kann dich hören!"
4. **English user should hear**: "Yes, I can hear you!"

### If test fails:
- Check microphone permissions
- Verify correct language selection
- Ensure both users are in same room
- Try refreshing both browsers

---

## Advanced Troubleshooting

### Browser Console Errors:
1. Press F12 → Console tab
2. Look for red error messages
3. Common errors:
   - `getUserMedia failed`: Microphone permission issue
   - `WebSocket connection failed`: Server not running
   - `Speech recognition not supported`: Browser compatibility

### Server-Side Debugging:
```bash
# Check if server is running
ps aux | grep node

# Restart server if needed
npm start

# Check server logs for room connections
tail -f server.log
```

### Network Issues:
- Ensure both users on same network (if running locally)
- Check firewall settings
- Verify port 3000 is accessible

---

## Success Indicators

### ✅ Connection Successful When:
- Both users see "2 users connected"
- Room code displays correctly
- Peer panel shows other user's flag
- Voice activity indicators work
- Translation audio plays correctly

### ❌ Connection Failed When:
- Only "1 users connected" showing
- No peer panel visible
- "Hold to Talk" button not responding
- No audio output during translation
- Console shows WebSocket errors

---

## Contact & Support

If issues persist:
1. Check all items in this troubleshooting guide
2. Verify browser compatibility and permissions
3. Test with different devices/networks
4. Check server logs for specific error messages
