import { useEffect, useState } from "react";

import { LearningFeed } from "./feed/LearningFeed";
import {
  fetchRoomBootstrap,
  readRoomLocation,
  roomSocketUrl,
} from "./room/room-client";
import type { RoomBootstrap, SocketServerMessage } from "../shared/protocol";

type ConnectionState = "connecting" | "connected" | "disconnected";

export function App() {
  const [roomLocation, setRoomLocation] = useState(() =>
    readRoomLocation(window.location),
  );
  const [room, setRoom] = useState<RoomBootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [previewStudent, setPreviewStudent] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => {
    const handleHashChange = () => {
      setRoom(null);
      setError(null);
      setConnection("connecting");
      setPreviewStudent(false);
      setRoomLocation(readRoomLocation(window.location));
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (roomLocation === null) {
      setError("Open the root page to create a fresh room.");
      return;
    }

    const controller = new AbortController();
    let socket: WebSocket | null = null;

    void fetchRoomBootstrap(roomLocation, controller.signal)
      .then((bootstrap) => {
        setRoom(bootstrap);
        socket = new WebSocket(roomSocketUrl(roomLocation.roomId));
        socket.addEventListener("open", () => {
          socket?.send(
            JSON.stringify({
              clientId: crypto.randomUUID(),
              payload: { token: roomLocation.token },
              type: "auth",
              v: 1,
            }),
          );
        });
        socket.addEventListener("message", (event) => {
          if (typeof event.data !== "string") return;
          const message = JSON.parse(event.data) as SocketServerMessage;
          if (message.type === "auth.accepted") setConnection("connected");
          if (message.type === "room.snapshot") setRoom(message.payload);
          if (message.type === "auth.rejected")
            setError("This room link is not authorized.");
        });
        socket.addEventListener("close", () => setConnection("disconnected"));
        socket.addEventListener("error", () => setConnection("disconnected"));
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error ? reason.message : "Room unavailable.",
          );
        }
      });

    return () => {
      controller.abort();
      socket?.close();
    };
  }, [roomLocation]);

  if (error !== null) {
    return (
      <main className="room-page">
        <section className="error-card" role="alert">
          <h1>Room unavailable</h1>
          <p>{error}</p>
          <a href="/">Create a fresh teacher room</a>
        </section>
      </main>
    );
  }

  if (room === null) {
    return (
      <main className="room-page">
        <p className="loading-state" role="status" aria-live="polite">
          Opening your learning room…
        </p>
      </main>
    );
  }

  const isTeacher = room.role === "teacher";
  const studentPerspective = room.role === "student" || previewStudent;
  const studentLink =
    isTeacher && room.studentCapability !== undefined
      ? `${window.location.origin}/r/${room.roomId}#token=${room.studentCapability}`
      : null;

  async function copyStudentLink(): Promise<void> {
    if (studentLink === null) return;
    try {
      await navigator.clipboard.writeText(studentLink);
      setCopyStatus("Student link copied.");
    } catch {
      setCopyStatus("Copy unavailable. Select the link field instead.");
    }
  }

  return (
    <main className="room-page">
      <header className="room-header">
        <a className="brand" href="/">
          Lost Lessons Lab
        </a>
        <div className="room-header__controls">
          <span
            className={`connection connection--${connection}`}
            role="status"
          >
            {connection === "connected"
              ? "Live room connected"
              : "Connecting to live room"}
          </span>
          {isTeacher && (
            <button
              aria-pressed={previewStudent}
              className="secondary-button"
              onClick={() => setPreviewStudent((value) => !value)}
              type="button"
            >
              {previewStudent ? "Return to teacher view" : "Preview as student"}
            </button>
          )}
        </div>
      </header>

      <section className="room-intro" aria-labelledby="room-title">
        <p className="room-intro__role">
          {studentPerspective ? "Student view" : "Teacher view"}
        </p>
        <h1 id="room-title">Make the math move.</h1>
        <p>
          Write a real solution, see how it was interpreted, and let the numbers
          control the physical result.
        </p>
      </section>

      {isTeacher && !previewStudent && studentLink !== null && (
        <section className="invite-card" aria-labelledby="invite-title">
          <div>
            <p className="feed-card__label">Separate learner access</p>
            <h2 id="invite-title">Invite the student</h2>
            <p>
              The learner link sees the shared task but never private teacher
              setup.
            </p>
          </div>
          <div className="invite-card__actions">
            <label htmlFor="student-link">Student link</label>
            <input id="student-link" readOnly value={studentLink} />
            <button
              className="secondary-button"
              onClick={copyStudentLink}
              type="button"
            >
              Copy student link
            </button>
            <span aria-live="polite">{copyStatus}</span>
          </div>
        </section>
      )}

      <LearningFeed
        events={room.events}
        studentPerspective={studentPerspective}
      />

      <footer className="room-footer">
        <p>
          Do not include names or personal information. Review every AI
          interpretation.
        </p>
      </footer>
    </main>
  );
}
