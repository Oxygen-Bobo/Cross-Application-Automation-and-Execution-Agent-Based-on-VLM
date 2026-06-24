import { createSignal } from "solid-js";

interface Props {
  onRun: (instruction: string) => void;
  onStop: () => void;
  disabled: boolean;
}

export default function TaskInput(props: Props) {
  const [text, setText] = createSignal("");

  const handleSubmit = () => {
    const t = text().trim();
    if (!t || props.disabled) return;
    props.onRun(t);
    setText("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div class="flex items-end gap-2">
      <textarea
        class="input flex-1 resize-none"
        rows={1}
        placeholder="Describe what you want the agent to do..."
        value={text()}
        onInput={(e) => {
          setText(e.currentTarget.value);
          // Auto-resize
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = Math.min(el.scrollHeight, 120) + "px";
        }}
        onKeyDown={handleKeyDown}
        disabled={props.disabled}
      />
      <button
        class="btn btn-primary h-[42px] w-[42px] p-0"
        onClick={handleSubmit}
        disabled={props.disabled || !text().trim()}
        title="Run"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 2.5v11l9-5.5L4 2.5z" />
        </svg>
      </button>
    </div>
  );
}
