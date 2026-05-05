# Dataset Setup Guide

The airline reservation system uses mock data from the [τ-bench](https://github.com/sierra-research/tau-bench) and [mabench](https://github.com/hinthornw/mabench) benchmarks. This data is not included in the repository and must be set up separately.

## Step 1: Clone the Benchmark Repositories

```bash
git clone https://github.com/sierra-research/tau-bench.git
git clone https://github.com/hinthornw/mabench.git
```

## Step 2: Create Data Directories

```bash
mkdir -p patterns/strands-swarm-agent/airline/data
```

## Step 3: Copy Benchmark Data

Copy the airline domain data files (flights, reservations, users) from the cloned repos into the data directory:

```bash
# Copy from tau-bench — adjust paths based on the repo structure
rsync -av --exclude='.git*' --exclude='.github' \
  tau-bench/tau_bench/envs/airline/data/ \
  patterns/strands-swarm-agent/airline/data/
```

The data directory should contain:
```
patterns/strands-swarm-agent/airline/data/
├── __init__.py      # Data loader (already in repo)
├── flights.json     # Flight routes and schedules
├── reservations.json # Booking records
└── users.json       # User profiles with loyalty status
```

## Expected Data Format

The swarm agent's tools expect these JSON structures:

### flights.json

Keyed by flight number. Each flight has a route, schedule, and per-date status:

```json
{
  "HAT001": {
    "flight_number": "HAT001",
    "origin": "PHL",
    "destination": "LGA",
    "scheduled_departure_time_est": "06:00:00",
    "scheduled_arrival_time_est": "07:00:00",
    "dates": {
      "2024-05-01": {
        "status": "landed",
        "actual_departure_time_est": "2024-05-01T06:26:00",
        "actual_arrival_time_est": "2024-05-01T06:58:00"
      },
      "2024-05-03": { "status": "cancelled" }
    }
  }
}
```

### users.json

Keyed by user ID. Each user has profile, payment methods, and loyalty info:

```json
{
  "mia_li_3668": {
    "name": { "first_name": "Mia", "last_name": "Li" },
    "address": {
      "address1": "975 Sunset Drive",
      "city": "Austin",
      "country": "USA",
      "province": "TX",
      "zip": "78750"
    },
    "email": "[email]",
    "dob": "1990-04-05",
    "payment_methods": {
      "credit_card_4421486": {
        "source": "credit_card",
        "brand": "visa",
        "last_four": "7447",
        "id": "credit_card_4421486"
      }
    }
  }
}
```

### reservations.json

Keyed by reservation ID. Each reservation has flights, passengers, and payment history:

```json
{
  "4WQ150": {
    "reservation_id": "4WQ150",
    "user_id": "chen_jackson_3290",
    "origin": "DFW",
    "destination": "LAX",
    "flight_type": "round_trip",
    "cabin": "business",
    "flights": [
      {
        "origin": "DFW",
        "destination": "LAX",
        "flight_number": "HAT170",
        "date": "2024-05-22",
        "price": 883
      }
    ],
    "passengers": [
      { "first_name": "Chen", "last_name": "Jackson", "dob": "1956-07-07" }
    ],
    "payment_history": [
      { "payment_id": "gift_card_3576581", "amount": 4986 }
    ]
  }
}
```

## Final Directory Structure

After setup, the airline module should look like:

```
patterns/strands-swarm-agent/airline/
├── __init__.py
├── data/
│   ├── __init__.py          # load_data() function (in repo)
│   ├── flights.json         # From τ-bench (not in repo)
│   ├── reservations.json    # From τ-bench (not in repo)
│   └── users.json           # From τ-bench (not in repo)
└── tools_strands/
    ├── __init__.py
    ├── book_reservation.py
    ├── calculate.py
    ├── cancel_reservation.py
    ├── get_reservation_details.py
    ├── get_user_details.py
    ├── list_all_airports.py
    ├── search_direct_flight.py
    ├── search_onestop_flight.py
    ├── send_certificate.py
    ├── think.py
    ├── transfer_to_human_agents.py
    ├── update_reservation_baggages.py
    ├── update_reservation_flights.py
    └── update_reservation_passengers.py
```

## Step 4: Clean Up Cloned Repos

```bash
rm -rf tau-bench mabench
```

## Step 5: Install τ-bench (Optional — for evaluation)

If you want to run τ-bench evaluations:

```bash
pip install -e tau-bench
```

## Running the Tools Modification Script

To prepare tool files for use with the Strands framework, run the `modifyToolsStrands.py` script which adds the necessary imports, decorators, and data loading code:

```bash
python modifyToolsStrands.py
```

This script will:
- Add `from strands import tool` import if not present
- Add `from airline.data import load_data` import if needed
- Add `@tool` decorator to tool functions if not present
- Replace `data = get_data()` calls with `data = load_data()`

## Creating Ground Truth Data (Optional)

To generate ground truth data for airline tasks:

```bash
python createGT.py --domain airline
```

This script:
- Converts task instructions into natural language questions using Claude via Amazon Bedrock
- Generates appropriate tool outputs for each action
- Saves updated tasks with questions and action results to `tasks_singleturn.json`

Requires AWS credentials with Bedrock access.

## References

- [τ-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains](https://arxiv.org/abs/2406.12045)
- [τ-bench GitHub](https://github.com/sierra-research/tau-bench)
- [mabench GitHub](https://github.com/hinthornw/mabench)
