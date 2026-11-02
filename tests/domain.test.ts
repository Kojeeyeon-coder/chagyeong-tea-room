import assert from "node:assert/strict";
import test from "node:test";
import { TEAS, TEAWARE } from "../lib/catalog";
import { choosePoeticName, POETIC_NAME_COUNT } from "../lib/name-generator";
import { findPath, isWalkable, SEAT_POSITIONS } from "../lib/navigation";
import { getTimeOfDay } from "../lib/time-of-day";
import { ROOM_IDS, ROOM_NAMES } from "../lib/chagyeong-types";
import { getTeaRoomWeather, weatherFromWmoCode } from "../lib/weather";

test("6대 다류와 말차, 네 다구를 제공한다", () => {
  assert.equal(TEAS.length, 7);
  assert.deepEqual(TEAS.map((tea) => tea.id), ["green", "white", "yellow", "oolong", "black", "dark", "matcha"]);
  assert.equal(TEAWARE.length, 4);
  assert.ok(TEAS.every((tea) => TEAWARE.some((ware) => ware.id === tea.recommended)));
});

test("20개 좌석 ID와 위치가 모두 고유하다", () => {
  assert.equal(SEAT_POSITIONS.length, 20);
  assert.equal(new Set(SEAT_POSITIONS.map((seat) => seat.id)).size, 20);
  assert.equal(new Set(SEAT_POSITIONS.map((seat) => `${seat.x},${seat.z}`)).size, 20);
  assert.equal(SEAT_POSITIONS.filter((seat) => seat.kind === "solo").length, 0);
  assert.equal(SEAT_POSITIONS.filter((seat) => seat.kind === "shared").length, 20);
  assert.equal(new Set(SEAT_POSITIONS.map((seat) => seat.table)).size, 5);
});

test("날씨 강제 옵션은 시각 검수에 맞는 상태를 돌려준다", () => {
  assert.equal(getTeaRoomWeather(new Date("2026-01-10"), "snow"), "snow");
  assert.equal(getTeaRoomWeather(new Date("2026-06-10"), "rain"), "rain");
  assert.equal(getTeaRoomWeather(new Date("2026-06-10"), "clear"), "clear");
  assert.equal(weatherFromWmoCode(63), "rain");
  assert.equal(weatherFromWmoCode(75), "snow");
  assert.equal(weatherFromWmoCode(1), "clear");
});

test("다섯 다실이 각 20명씩 총 100명을 수용한다", () => {
  assert.equal(ROOM_IDS.length, 5);
  assert.equal(new Set(ROOM_IDS.map((room) => ROOM_NAMES[room])).size, 5);
  assert.equal(ROOM_IDS.length * SEAT_POSITIONS.length, 100);
});

test("경로 탐색은 찻상을 피해 목표까지 도달한다", () => {
  const path = findPath({ x: -8, z: 10 }, { x: 7.5, z: -5 });
  assert.ok(path.length > 0);
  assert.ok(path.every(isWalkable));
  assert.deepEqual(path.at(-1), { x: 7.5, z: -5 });
  assert.deepEqual(findPath({ x: 0, z: 10 }, { x: 0, z: 3 }), []);
});

test("기기 현지 시각과 강제 모드로 조명을 결정한다", () => {
  assert.equal(getTimeOfDay(new Date(2026, 9, 31, 9)), "day");
  assert.equal(getTimeOfDay(new Date(2026, 9, 31, 18)), "dusk");
  assert.equal(getTimeOfDay(new Date(2026, 9, 31, 23)), "night");
  assert.equal(getTimeOfDay(new Date(), "night"), "night");
});

test("꽃 이름은 현재 방에서 중복되지 않는다", () => {
  assert.equal(POETIC_NAME_COUNT, 256);
  const first = choosePoeticName(new Set(), () => 0);
  const second = choosePoeticName(new Set([first]), () => 0);
  assert.equal(first, "하얀 동백");
  assert.equal(second, "하얀 장미");
  assert.notEqual(second, first);
});
