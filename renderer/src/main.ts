import "./styles.css";

const messageElement = document.getElementById("message");

if (messageElement) {
  fetch("/api/hello-world")
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      return (await response.json()) as { value?: string };
    })
    .then((body) => {
      messageElement.textContent = body.value ?? "No value returned";
    })
    .catch(() => {
      messageElement.textContent = "Failed to load hello world value";
    });
}
