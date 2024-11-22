"""Entry point for the application."""

import logging

from datetime import timezone


from flask import Flask, g, request
from flask_cors import CORS
from waitress import serve

from apis import api


def create_app(config_module=None, loglevel="INFO"):
    """Initialize the core application."""
    # create and configure the app
    app = Flask(__name__)
    # `full` if you want to see all the details
    app.config["SWAGGER_UI_DOC_EXPANSION"] = "none"
    app.config["RESTX_MASK_SWAGGER"] = False

    # set up logging
    logging.basicConfig(level=getattr(logging, loglevel))

    # Initialize config
    app.config.from_object(config_module or "config")

    # TODO - fix this
    # csrf = CSRFProtect()
    # csrf.init_app(app)

    api.init_app(app)

    cors_origins = [
        "https://staging.codefair.io",
        "https://codefair.io",
        "http://localhost:3001",
        "http://localhost:3000"
    ]
    if app.debug:
        cors_origins.extend(["http://localhost:3000", "http://localhost:3001"])

    # Only allow CORS origin for localhost:3000
    # and any subdomain of azurestaticapps.net/
    CORS(
        app,
        resources={
            "/*": {
                "origins": cors_origins,
                # "origins": "*",
            }
        },
        allow_headers=[
            "Content-Type",
            "Authorization",
            "Access-Control-Allow-Origin",
            "Access-Control-Allow-Credentials",
        ],
        supports_credentials=True,
    )

    return app


if __name__ == "__main__":
    from argparse import ArgumentParser

    parser = ArgumentParser()
    parser.add_argument(
        "-P", "--port", default=5000, type=int, help="Port to listen on"
    )
    parser.add_argument("-H", "--host", default="0.0.0.0", type=str, help="Host")
    parser.add_argument(
        "-L", "--loglevel", default="INFO", type=str, help="Logging level"
    )
    args = parser.parse_args()
    port = args.port
    host = args.host
    loglevel = args.loglevel

    flask_app = create_app(loglevel=loglevel)

    serve(flask_app, port=port, host=host)
