# cwl-validator

## Getting started

### Prerequisites/Dependencies

You will need the following installed on your system:

- Python 3.8+
- [Pip](https://pip.pypa.io/en/stable/)
- [Docker](https://www.docker.com/)

### Setup

If you would like to update the api, please follow the instructions below.

1. Create a local virtual environment and activate it:

   ```bash
   python -m venv .venv
   source .venv/bin/activate
   ```

   If you are using Anaconda, you can create a virtual environment with:

   ```bash
   conda create -n cwl-validator-dev-env python=3.10
   conda activate cwl-validator-dev-env
   ```

2. Install the dependencies for this package.

   ```bash
   pip install -r requirements.txt
   ```

## Running

For developer mode:

```bash
python3 app.py --host $HOST --port $PORT
```

or

```bash
flask run --debug
```

For production mode:

```bash
python3 app.py --host $HOST --port $PORT
```
