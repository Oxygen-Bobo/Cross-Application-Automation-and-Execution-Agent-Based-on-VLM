import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import App from "./App";
import ChatView from "./routes/ChatView";
import ApiSettingsView from "./routes/ApiSettingsView";
import ScheduleView from "./routes/ScheduleView";
import "./styles/global.css";

// Dynamic import for floating ball to avoid bundling it in main app
const isFloating = window.location.hash === "#/floating";

if (isFloating) {
  import("./floating").then(m => m.default());
} else {
  render(
    () => (
      <Router root={App}>
        <Route path="/" component={ChatView} />
        <Route path="/schedule" component={ScheduleView} />
        <Route path="/settings" component={ApiSettingsView} />
      </Router>
    ),
    document.getElementById("root")!,
  );
}
