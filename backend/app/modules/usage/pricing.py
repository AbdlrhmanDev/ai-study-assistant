"""Approximate USD-per-1K-token pricing, used only to turn the durable
usage ledger's conservative token *estimate* (`len(text)//4`, see
`service.record`) into a directional cost figure for the admin dashboard --
not an exact bill. Public list prices at time of writing; review and update
here when a provider changes pricing, no schema change needed."""

# (provider, model) -> (usd_per_1k_input_tokens, usd_per_1k_output_tokens)
PRICING_USD_PER_1K_TOKENS: dict[tuple[str, str], tuple[float, float]] = {
    ("gemini", "gemini-2.5-flash"): (0.00030, 0.00250),
    ("gemini", "gemini-embedding-001"): (0.00015, 0.0),
    ("openai", "gpt-4.1-mini"): (0.00040, 0.00160),
    ("openai", "text-embedding-3-small"): (0.00002, 0.0),
    ("groq", "llama-3.3-70b-versatile"): (0.00059, 0.00079),
}

_DEFAULT_PRICE = (0.0, 0.0)


def estimate_cost_usd(provider: str, model: str, input_tokens: int, output_tokens: int) -> float:
    price_in, price_out = PRICING_USD_PER_1K_TOKENS.get((provider, model), _DEFAULT_PRICE)
    return round((input_tokens / 1000) * price_in + (output_tokens / 1000) * price_out, 6)
