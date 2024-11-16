FROM python:3.10-alpine
# FROM ubuntu/python:stable

EXPOSE 5000

WORKDIR /app

ENV POETRY_VERSION=1.3.2

# RUN apt-get update
# RUN sudo apt-get install cwltool 

RUN apk update
RUN apk add --no-cache gcc libffi-dev musl-dev
# RUN apk add --update cwltool

RUN pip install "poetry==$POETRY_VERSION"

# COPY poetry.lock pyproject.toml ./
COPY pyproject.toml .

RUN poetry config virtualenvs.create false
RUN poetry install

RUN pip install cwltool
RUN pip install cffconvert

COPY apis ./apis
COPY config.py .
COPY app.py .

# COPY entrypoint.sh .

# RUN chmod +x entrypoint.sh

ENTRYPOINT [ "python3" ]

CMD [ "app.py" ]

# ENTRYPOINT ["./entrypoint.sh"]