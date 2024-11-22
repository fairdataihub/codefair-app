"""Initialize the api system for the backend"""

import json
import re
import subprocess
import jsonschema
from flask_restx import Api, Resource


api = Api(
    title="CWL Validator API",
    description="The backend api system for the CWL Validator",
    doc="/docs",
)


@api.route("/echo", endpoint="echo")
class HelloEverynyan(Resource):
    """Test if the server is active"""

    @api.response(200, "Success")
    @api.response(400, "Validation Error")
    def get(self):
        """Returns a simple 'Server Active' message"""

        return "Server active!"


@api.route("/up", endpoint="up")
class Up(Resource):
    """Health check for kamal"""

    @api.response(200, "Success")
    def get(self):
        """Returns a simple message"""

        return ":)"


@api.route("/validate-cwl", endpoint="validate-cwl")
class ValidateCWL(Resource):
    """Validate a CWL file"""

    @api.response(200, "Success")
    @api.response(400, "Validation Error")
    @api.expect(
        api.parser().add_argument(
            "file_path",
            type=str,
            help="The file path or URL of the CWL file",
            required=True,
        )
    )
    def post(self):
        """Validate a CWL file"""

        file_path = api.payload.get("file_path")

        # Validate and sanitize the file_path input
        if not file_path:
            return {
                "message": "Validation Error",
                "error": "file_path is required",
            }, 400

        # Prevent path traversal attacks
        if ".." in file_path or file_path.startswith("/"):
            return {"message": "Validation Error", "error": "Invalid file path"}, 400

        # Prevent command injection
        if re.search(r"[;&|]", file_path):
            return {
                "message": "Validation Error",
                "error": "Invalid characters in file path",
            }, 400

        def clean_output(output):
            # Remove ANSI escape codes
            ansi_escape = re.compile(r"\x1B[@-_][0-?]*[ -/]*[@-~]")
            cleaned_output = ansi_escape.sub("", output).strip()
            # Remove INFO messages and unnecessary whitespace, and replace newlines with spaces
            cleaned_lines = []
            for line in cleaned_output.splitlines():
                if not line.startswith("INFO"):
                    cleaned_lines.append(line.strip())
            return " ".join(cleaned_lines)

        try:
            result = subprocess.run(
                ["cwltool", "--validate", file_path],
                capture_output=True,
                text=True,
                check=True,
            )
            stdout_clean = clean_output(result.stdout)
            stderr_clean = clean_output(result.stderr)
            return {
                "message": "Validation successful",
                "output": stdout_clean,
                "error": stderr_clean,
            }, 200
        except subprocess.CalledProcessError as e:
            stdout_clean = clean_output(e.stdout)
            stderr_clean = clean_output(e.stderr)
            return {
                "message": "Validation failed",
                "output": stdout_clean,
                "error": stderr_clean,
            }, 400
        except Exception as e:
            return {"message": "An unexpected error occurred", "error": str(e)}, 500


@api.route("/validate-citation", endpoint="validate-citation")
class ValidateCitation(Resource):
    """Validate a CITATION.cff file"""

    @api.response(200, "Success")
    @api.response(400, "Validation Error")
    @api.expect(
        api.parser().add_argument(
            "file_path",
            type=str,
            help="The URL or path of the CITATION file",
            required=True,
        )
    )
    def post(self):
        """Validate a CITATION.cff file"""
        file_path = api.payload.get("file_path")

        # Validate and sanitize the file_path input
        if not file_path:
            return {
                "message": "Validation Error",
                "error": "file_path is required",
            }, 400

        # Prevent path traversal attacks
        if ".." in file_path or file_path.startswith("/"):
            return {"message": "Validation Error", "error": "Invalid file path"}, 400

        # Prevent command injection
        if re.search(r"[;&|]", file_path):
            return {
                "message": "Validation Error",
                "error": "Invalid characters in file path",
            }, 400

        if file_path.startswith("http://") or file_path.startswith("https://"):
            cmd = ["cffconvert", "--validate", "-u", file_path]
        else:
            cmd = ["cffconvert", "--validate", file_path]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True,
            )

            stdout_clean = result.stdout
            stderr_clean = result.stderr
            return {
                "message": "valid",
                "output": stdout_clean,
                "error": stderr_clean,
            }, 200
        except subprocess.CalledProcessError as e:
            stdout_clean = e.stdout
            match = re.search(r"jsonschema.exceptions.ValidationError:.*", e.stderr)
            stderr_clean = match[0] if match else "Unknown error"
            return {
                "message": "invalid",
                "output": stdout_clean,
                "error": stderr_clean,
            }, 400
        except Exception as e:
            return {"message": "An unexpected error occurred", "error": str(e)}, 500


@api.route("/validate-codemeta", endpoint="validate-codemeta")
class ValidateCodemeta(Resource):
    """Validate a codemeta.json file using a schema"""

    @api.response(200, "Success")
    @api.response(400, "Validation Error")
    @api.expect(
        api.parser().add_argument(
            "file_content",
            type=str,
            help="The content of the codemeta.json file",
            required=True,
        )
    )
    def post(self):
        """Validate a codemeta.json file"""
        file_content = api.payload.get("file_content")

        # if file content is string, convert to json
        if isinstance(file_content, str):
            try:
                file_content = json.loads(file_content)
            except Exception as e:
                return {
                    "message": "Validation Error",
                    "error": "Invalid JSON: " + str(e),
                }, 400

        codemeta_context = file_content.get("@context", "")
        if codemeta_context == "https://doi.org/10.5063/schema/codemeta-2.0":
            codemeta_version = "2.0"
        elif codemeta_context == "https://w3id.org/codemeta/3.0":
            codemeta_version = "3.0"
        else:
            return {
                "message": "Validation Error",
                "error": "Unsupported codemeta version",
            }, 400
        try:
            with open("./codemeta-schema.json", "r", encoding="utf-8") as f:
                schema = json.load(f)
                jsonschema.validate(file_content, schema)

            return {
                "message": "valid",
                "version": codemeta_version,
            }, 200
        except jsonschema.exceptions.ValidationError as e:
            return {
                "message": "invalid",
                "error": str(e.message + " at " + str(e.validator_value)),
            }, 200
