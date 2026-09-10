import { describe, expect, it } from "vitest";
import { TextInputBinding } from "./text-input-binding";

describe("TextInputBinding", () => {
  it("restores focus and caret after a renderer replaces the input", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    host.innerHTML = '<input data-field="name" value="">';
    const binding = new TextInputBinding(host, ({ value }) => {
      host.innerHTML = `<input data-field="name" value="${value}">`;
    });
    binding.connect();

    const first = host.querySelector<HTMLInputElement>('[data-field="name"]')!;
    first.focus(); first.value = "Ca"; first.setSelectionRange(2, 2);
    first.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();

    const updatedInput = host.querySelector<HTMLInputElement>('[data-field="name"]')!;
    expect(updatedInput).toBe(first);
    expect(updatedInput.value).toBe("Ca");
    expect(document.activeElement).toBe(updatedInput);
    expect(updatedInput.selectionStart).toBe(2);
    binding.disconnect();
  });
});
