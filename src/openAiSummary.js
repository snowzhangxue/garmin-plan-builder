async function generateActivitySummary({
  apiKey,
  model,
  provider = "gemini",
  date,
  summaries
} = {}) {
  if (!apiKey) {
    throw new Error("Missing API key.");
  }

  const normalizedProvider = provider.toLowerCase();
  const resolvedModel =
    model ||
    (normalizedProvider === "openai" ? "gpt-5-nano" : "gemini-1.5-flash");
  const debugEnabled = process.env.LLM_DEBUG === "true";

  const prompt = [
    "You are a coach summarizing a Garmin training day based on the activity data provided.",
    "Summarize today's training and provide a recommendation for tomorrow."
  ].join(" ");

  const userContent = {
    date,
    activities: summaries
  };

  let response;
  if (normalizedProvider === "openai") {
    const requestBody = {
      model: resolvedModel,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: JSON.stringify(userContent) }
      ],
      max_tokens: 180,
      temperature: 0.7
    };
    if (debugEnabled) {
      const payloadText = JSON.stringify(requestBody);
      console.debug("LLM request meta:", {
        provider: normalizedProvider,
        model: resolvedModel,
        url: "https://api.openai.com/v1/chat/completions",
        payloadBytes: Buffer.byteLength(payloadText)
      });
      console.debug("LLM request payload:\n" + payloadText);
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
        maxOutputTokens: 180,
        temperature: 0.7
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
      console.debug("LLM request payload:\n" + payloadText);
    }
    response = await fetch(
      url,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(requestBody)
      }
    );
  } else {
    throw new Error(`Unknown summary provider: ${provider}`);
  }

  const responseText = await response.text();
  if (debugEnabled) {
    const requestId =
      response.headers.get("x-request-id") ||
      response.headers.get("x-goog-request-id");
    console.debug("LLM response meta:", {
      provider: normalizedProvider,
      model: resolvedModel,
      status: response.status,
      requestId: requestId || undefined,
      bodyBytes: Buffer.byteLength(responseText)
    });
    console.debug("LLM response body:\n" + responseText);
  }

  if (!response.ok) {
    const errorText = responseText;
    const error = new Error(`${normalizedProvider} summary request failed.`);
    error.status = response.status;
    error.body = errorText;
    throw error;
  }

  const data = responseText ? JSON.parse(responseText) : {};
  if (normalizedProvider === "openai") {
    return data?.choices?.[0]?.message?.content?.trim() || "";
  }
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

module.exports = {
  generateActivitySummary
};
