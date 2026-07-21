import { describe, expect, it } from "vitest";

import {
  constantTimeEqual,
  deriveStudentCapability,
  generateRoomId,
  generateTeacherCapability,
  hashCapability,
} from "../../src/worker/security/capabilities";

const pepper = "unit-test-room-pepper-with-at-least-thirty-two-bytes";

describe("room capabilities", () => {
  it("generates high-entropy room and teacher values", () => {
    const rooms = new Set(Array.from({ length: 32 }, () => generateRoomId()));
    const capabilities = new Set(
      Array.from({ length: 32 }, () => generateTeacherCapability()),
    );

    expect(rooms.size).toBe(32);
    expect(capabilities.size).toBe(32);
    expect([...capabilities].every((value) => value.length >= 43)).toBe(true);
  });

  it("derives a stable, room-specific student capability", async () => {
    const teacher = generateTeacherCapability();
    const first = await deriveStudentCapability(
      pepper,
      "rm_first-room-identifier",
      teacher,
    );
    const repeated = await deriveStudentCapability(
      pepper,
      "rm_first-room-identifier",
      teacher,
    );
    const otherRoom = await deriveStudentCapability(
      pepper,
      "rm_other-room-identifier",
      teacher,
    );

    expect(first).toBe(repeated);
    expect(first).not.toBe(otherRoom);
    expect(first).not.toBe(teacher);
  });

  it("hashes roles independently and compares without early length exit", async () => {
    const capability = generateTeacherCapability();
    const teacherHash = await hashCapability(pepper, "teacher", capability);
    const studentHash = await hashCapability(pepper, "student", capability);

    expect(teacherHash).not.toBe(capability);
    expect(teacherHash).not.toBe(studentHash);
    expect(constantTimeEqual(teacherHash, teacherHash)).toBe(true);
    expect(constantTimeEqual(teacherHash, `${teacherHash}x`)).toBe(false);
  });
});
