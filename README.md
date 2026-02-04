This is a tools to help building garmin plan easier. You don't need to go thru the garmin UI to create the plan. Simply decribe your training plan or even upload a picture and the tools will create the plan, upload to your Garmin account.

## Setup

1. Copy `config/garmin-config.sample.json` to `config/garmin-config.json`.
2. Fill in your Garmin username and password.

## Input plans

- Place plan files in `input-plans/`.
- Filenames must be `YYYY-WW` (example: `2026-05` for week 5 of 2026).
- Each line can be plain English, with optional day prefixes:

```
Mon: Easy run 30 min
Wed: Intervals 6x400m
Fri: Rest day
Notes: Keep HR below 150.
```

## Generate plans

Generate all plans:

```
yarn generate-plans
```

Generate a single plan by name:

```
yarn generate-plans 2026-05
```

Plans are written to `plans/` using the format `start_date - end_date.json`.

## Login test

```
yarn garmin-login
```

This uses `config/garmin-config.json` and the `SIGNIN_URL` constant to attempt a login and prints the response status.

## Activity summary UI

Start the web UI:

```
yarn web
```

Open `http://localhost:3000` to enter Garmin credentials, choose a date, and view the activity summary.

## Gemini summary

Set `GEMINI_API_KEY` or add `geminiApiKey` to `config/garmin-config.json` to enable coach-style summaries (default provider):

```
GEMINI_API_KEY=your_key_here yarn web
```

Optional overrides:

- `SUMMARY_PROVIDER=openai` to use OpenAI instead of Gemini.
- `SUMMARY_MODEL=...` to override the default model for either provider.
- `summaryProvider` and `summaryModel` can also be set in `config/garmin-config.json` (env vars take precedence).

## OpenAI summary

Set `OPENAI_API_KEY` or add `openaiApiKey` to `config/garmin-config.json` to enable coach-style summaries:

```
OPENAI_API_KEY=your_key_here yarn web
```
