import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/question
 * body: { category?: string }
 * returns: { question, answer, unit?, category, source? }
 */
export async function POST(req: Request) {
  try {
    const { category, usedQuestions = [] } = await req.json().catch(() => ({}));
    
    // Development fallback when no API key is configured
    if (!process.env.OPENAI_API_KEY) {
      const allowed = [
        "celebrity_age",
        "country_population",
        "avg_temperature",
        "building_height",
        "distance_length",
        "time_dates",
        "sports_numbers",
        "space_numbers",
      ];
      const chosen = allowed.includes(category) ? category : allowed[Math.floor(Math.random() * allowed.length)];
      const samples: Record<string, { question: string; answer: number; unit?: string; source?: string }> = {
        celebrity_age: { question: "How old is Taylor Swift (years)?", answer: 34, unit: "years", source: "https://en.wikipedia.org/wiki/Taylor_Swift" },
        country_population: { question: "Population of Denmark (millions)?", answer: 5.9, unit: "million", source: "https://data.worldbank.org/indicator/SP.POP.TOTL?locations=DK" },
        avg_temperature: { question: "Average July temperature in Rome (°C)?", answer: 25, unit: "°C", source: "https://www.metoffice.gov.uk/weather/travel/holiday-weather/europe/italy/rome" },
        building_height: { question: "Height of the Eiffel Tower (m)?", answer: 324, unit: "m", source: "https://www.toureiffel.paris/en/the-monument" },
        distance_length: { question: "Length of the Golden Gate Bridge (m)?", answer: 2737, unit: "m", source: "https://www.goldengatebridge.org/bridge/history-research/facts-stats.php" },
        time_dates: { question: "What year did the iPhone launch?", answer: 2007, source: "https://www.apple.com/stevejobs/" },
        sports_numbers: { question: "How many players on a soccer team on the field?", answer: 11, source: "https://www.fifa.com/" },
        space_numbers: { question: "Distance from Earth to the Moon (km)?", answer: 384400, unit: "km", source: "https://solarsystem.nasa.gov/moons/earths-moon/overview/" },
      };
      const data = samples[chosen];
      return NextResponse.json({
        question: data.question,
        answer: data.answer,
        unit: data.unit || "",
        category: chosen,
        source: data.source || "",
      });
    }

    // Categories we support (you can add more later)
    const allowed = [
      "celebrity_age",
      "country_population",
      "avg_temperature",
      "building_height",
      "distance_length",
      "time_dates",
      "sports_numbers",
      "space_numbers",
    ];
    const chosen = allowed.includes(category) ? category : allowed[Math.floor(Math.random() * allowed.length)];

    const system = `
You write ONE numeric-trivia question at a time.

Rules:
- The question must have a single numeric answer, optionally with a unit (e.g., km, °C, m).
- Prefer well-known or easy-to-verify facts.
- Return ONLY valid JSON that matches:
  {
    "question": "string",
    "answer": number,
    "unit": "string or empty",
    "category": "string",
    "source": "short URL or empty"
  }
    `.trim();

    const user = `
Category: ${chosen}
Used questions to avoid: ${usedQuestions.map((q: any) => q.question).join('; ')}

Examples:
- celebrity_age → "How old is Zendaya in years?"
- country_population → "Population of Denmark (millions, approx to 0.1)?"
- avg_temperature → "Average July temperature in Rome (°C)?"
- building_height → "Height of the Statue of Liberty (m)?"
- sports_numbers → "Total goals scored by Lionel Messi for Argentina (as of 2024)?"

IMPORTANT: Generate a completely different question that has NOT been used before.
Return JSON only—no backticks, no commentary.
    `.trim();

    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    });

    const text = resp.choices[0]?.message?.content || "{}";
    const data = JSON.parse(text);

    if (typeof data?.question !== "string" || typeof data?.answer !== "number") {
      return NextResponse.json({ error: "Invalid question format" }, { status: 500 });
    }

    return NextResponse.json({
      question: data.question,
      answer: data.answer,
      unit: data.unit || "",
      category: data.category || chosen,
      source: data.source || "",
    });
  } catch (err: any) {
    console.error("API Error:", err);
    return NextResponse.json({ 
      error: err?.message || "Server error",
      details: process.env.NODE_ENV === "development" ? err?.stack : undefined
    }, { status: 500 });
  }
}
