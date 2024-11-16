# cwl-validator

## Getting started

### Prerequisites/Dependencies

You will need the following installed on your system:

- Python 3.8+
- [Pip](https://pip.pypa.io/en/stable/)
- [Poetry](https://python-poetry.org/)
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

2. Install the dependencies for this package. We use [Poetry](https://python-poetry.org/) to manage the dependencies:

   ```bash
   pip install poetry==1.3.2
   poetry install
   ```

   You can also use version 1.2.0 of Poetry, but you will need to run `poetry lock` after installing the dependencies.

3. Add your environment variables. An example is provided at `.env.example`

   ```bash
   cp .env.example .env
   ```

   Make sure to update the values in `.env` to match your local setup.

4. Add your modifications and run the tests:

   ```bash
   poetry run pytest
   ```

   If you need to add new python packages, you can use Poetry to add them:

   ```bash
    poetry add <package-name>
   ```

5. Format the code:

   ```bash
   poe format
   ```

6. Check the code quality:

   ```bash
   poe typecheck
   poe lint
   poe flake8
   ```

   You can also use `poe precommit` to run both formatting and linting.

7. Run the tests and check the code coverage:

   ```bash
   poe test
   poe test_with_capture # if you want to see console output
   ```

## Running

For developer mode:

```bash
poe dev
```

or

```bash
flask run --debug
```

For production mode:

```bash
python3 app.py --host $HOST --port $PORT
```
