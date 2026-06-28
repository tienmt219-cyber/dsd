// ═══════════════════════════════════════════════════════════════
// Apps Script — Claude API integration for AI tab
// Replace the existing aiProxy() and setAIKey() functions
// ═══════════════════════════════════════════════════════════════

// ── AI KEY SETUP ──
// Run this once from Apps Script editor to store your Anthropic API key
function setAIKey() {
  PropertiesService.getScriptProperties().setProperty(
    'ANTHROPIC_API_KEY',
    'sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' // ← Replace with your actual API key
  );
  Logger.log('Anthropic API key saved.');
}

// ── AI PROXY (Claude Messages API) ──
// Called from frontend: api("aiProxy", "", {prompt, systemPrompt, maxTokens})
// Returns: {success: true, text: "..."} or {error: "..."}
function aiProxy(data) {
  try {
    var key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
    if (!key) return { error: 'APIキーが設定されていません。setAIKey()を実行してください。' };

    var prompt = data.prompt || '';
    var systemPrompt = data.systemPrompt || '';
    var maxTokens = data.maxTokens || 2000;

    var payload = {
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      messages: [
        { role: 'user', content: prompt }
      ]
    };

    if (systemPrompt) {
      payload.system = systemPrompt;
    }

    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', options);
    var status = response.getResponseCode();
    var json = JSON.parse(response.getContentText());

    if (status !== 200) {
      var errMsg = json.error ? json.error.message : 'API error (status ' + status + ')';
      return { error: errMsg };
    }

    var text = '';
    if (json.content && json.content.length > 0) {
      for (var i = 0; i < json.content.length; i++) {
        if (json.content[i].type === 'text') {
          text += json.content[i].text;
        }
      }
    }

    return { success: true, text: text || '応答なし' };

  } catch (e) {
    return { error: 'Claude API エラー: ' + e.message };
  }
}

// ── setupPassword() — update the comment about AI key ──
// If your existing setupPassword() references Gemini, update it like this:
function setupPassword() {
  var sp = PropertiesService.getScriptProperties();
  sp.setProperty('ADMIN_PASS', 'your_password_here');
  // To set the Anthropic API key, run setAIKey() separately
  Logger.log('Setup complete.');
}
