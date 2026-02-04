async function callLLM({ apiKey, provider, model, prompt, userContent, maxTokens = 700 } = {}) {
  if (!apiKey) throw new Error("Missing API key.");
  const normalizedProvider = (provider || "gemini").toLowerCase();
  const resolvedModel =
    model || (normalizedProvider === "openai" ? "gpt-5-nano" : "gemini-1.5-flash");
  const debugEnabled = process.env.LLM_DEBUG === "true";

  let response;
  if (normalizedProvider === "openai") {
    const requestBody = {
      model: resolvedModel,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: JSON.stringify(userContent) }
      ],
      max_tokens: maxTokens,
      temperature: 0.6
    };
    if (debugEnabled) {
      const payloadText = JSON.stringify(requestBody);
      console.debug("LLM request meta:", {
        provider: normalizedProvider,
        model: resolvedModel,
        url: "https://api.openai.com/v1/chat/completions",
        payloadBytes: Buffer.byteLength(payloadText)
      });
    }

    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });
  } else if (normalizedProvider === "gemini") {
    const requestBody = {
      systemInstruction: {
        role: "system",
        parts: [{ text: prompt }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: JSON.stringify(userContent) }]
        }
      ],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.6
      }
    };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent?key=${apiKey}`;
    if (debugEnabled) {
      const payloadText = JSON.stringify(requestBody);
      console.debug("LLM request meta:", {
        provider: normalizedProvider,
        model: resolvedModel,
        url: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        payloadBytes: Buffer.byteLength(payloadText)
      });
    }

    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });
  } else {
    throw new Error(`Unknown summary provider: ${provider}`);
  }

  const responseText = await response.text();

  if (!response.ok) {
    const error = new Error(`${normalizedProvider} summary request failed.`);
    error.status = response.status;
    error.body = responseText;
    throw error;
  }

  const data = responseText ? JSON.parse(responseText) : {};
  if (normalizedProvider === "openai") {
    return data?.choices?.[0]?.message?.content?.trim() || "";
  }
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

async function generateEightDaySummaryAndPlan({
  apiKey,
  model,
  provider,
  startDate,
  endDate,
  days
} = {}) {
  const prompt =
    "You are an expert running coach + strength coach + yoga instructor. " +
    "You will be given 8 days of Garmin data (training + sleep/body). " +
    "1) Summarize the previous training (volume/intensity) and body status (sleep/resting HR/steps/weight/wellness). " +
    "2) Identify signs of fatigue or readiness. " +
    "3) Provide a 7-day training recommendation starting tomorrow, including running, strength, and yoga. " +
    "Return a concise, practical plan with day-by-day bullets. " +
    "If data is missing, make reasonable assumptions and mention what is missing.";

  const userContent = {
    startDate,
    endDate,
    days
  };

  return callLLM({
    apiKey,
    provider,
    model,
    prompt,
    userContent,
    maxTokens: 800
  });
}

module.exports = {
  callLLM,
  generateEightDaySummaryAndPlan
};
