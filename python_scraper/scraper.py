import asyncio
import json
import re
import sys
import argparse
import httpx
from bs4 import BeautifulSoup

# Strictly Greenhouse company boards ONLY
DEFAULT_BOARDS = [
    "figma",
    "stripe",
    "discord",
    "vercel",
    "retool",
    "databricks",
    "cloudflare",
    "openai",
    "airbnb",
    "doordash",
    "canonical",
    "gitlab"
]

BASE_GREENHOUSE_URL = "https://boards-api.greenhouse.io/v1/boards"

def strip_html(html_str):
    if not html_str:
        return "No description available."
    soup = BeautifulSoup(html_str, "html.parser")
    text = soup.get_text(separator=" ", strip=True)
    text = re.sub(r'&[a-zA-Z0-9#]+;', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:600] + ("..." if len(text) > 600 else "")

async def fetch_greenhouse_board(client, board_token, max_jobs=10):
    url = f"{BASE_GREENHOUSE_URL}/{board_token}/jobs?content=true"
    try:
        resp = await client.get(url, timeout=15.0)
        if resp.status_code != 200:
            return {"board": board_token, "source": "greenhouse", "error": f"Greenhouse API HTTP {resp.status_code}", "jobs": []}
        
        data = resp.json()
        raw_jobs = data.get("jobs", [])
        selected = raw_jobs[:max_jobs]
        normalized = []

        company_name = board_token.capitalize()

        for raw in selected:
            loc = "Remote / Not specified"
            if raw.get("location") and raw["location"].get("name"):
                loc = raw["location"]["name"]
            elif raw.get("offices") and len(raw["offices"]) > 0 and raw["offices"][0].get("location"):
                loc = raw["offices"][0]["location"]

            job_id = f"gh_{board_token}_{raw['id']}"
            job_url = raw.get("absolute_url") or f"https://job-boards.greenhouse.io/{board_token}/jobs/{raw['id']}"
            app_url = f"https://job-boards.greenhouse.io/{board_token}/jobs/{raw['id']}?gh_jid={raw['id']}"

            normalized.append({
                "id": job_id,
                "title": raw.get("title", "Untitled Position"),
                "company": company_name,
                "company_board": board_token.lower(),
                "location": loc,
                "description": strip_html(raw.get("content", "")),
                "job_url": job_url,
                "application_url": app_url,
                "source": "greenhouse"
            })

        return {"board": board_token, "source": "greenhouse", "jobs": normalized, "total": len(raw_jobs)}

    except Exception as e:
        return {"board": board_token, "source": "greenhouse", "error": str(e), "jobs": []}

async def scrape_all(boards, max_per_board=10):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    }
    
    async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
        tasks = [fetch_greenhouse_board(client, b.strip().lower(), max_per_board) for b in boards if b.strip()]
        results = await asyncio.gather(*tasks)

        total_inserted = 0
        all_jobs = []

        for r in results:
            jobs = r.get("jobs", [])
            total_inserted += len(jobs)
            all_jobs.extend(jobs)

        return {
            "success": True,
            "total_jobs": total_inserted,
            "boards_count": len(boards),
            "results": results,
            "jobs": all_jobs
        }

def main():
    parser = argparse.ArgumentParser(description="Greenhouse-Only Job Scraper")
    parser.add_argument("--boards", type=str, default="", help="Comma separated Greenhouse board tokens")
    parser.add_argument("--max", type=int, default=10, help="Max jobs per board")

    args = parser.parse_args()

    if args.boards:
        boards = [b.strip() for b in args.boards.split(",") if b.strip()]
    else:
        boards = DEFAULT_BOARDS

    output = asyncio.run(scrape_all(boards, args.max))
    sys.stdout.write(json.dumps(output, indent=2))

if __name__ == "__main__":
    main()
