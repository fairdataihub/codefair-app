export async function info(message, type = "text") {
  try {
    const body = {
      type,
      message,
      level: "info",
    };

    await fetch(
      "https://logwatch.fairdataihub.org/api/log/cm4hkn79200027r01ya9gij7r",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + process.env.LOGWATCH_TOKEN,
        },
        body: JSON.stringify(body),
      },
    );
  } catch (error) {
    console.log(error);
  }
}

export async function error(message, type = "text") {
  try {
    const body = {
      type,
      message,
      level: "error",
    };

    await fetch(
      "https://logwatch.fairdataihub.org/api/log/cm4hkn79200027r01ya9gij7r",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + process.env.LOGWATCH_TOKEN,
        },
        body: JSON.stringify(body),
      },
    );
  } catch (error) {
    console.log(error);
  }
}
