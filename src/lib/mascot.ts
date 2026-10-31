/** Пози маскота Орі; файли лежать у public/mascot/ori-<поза>.svg. */
export type OriPose = "idle" | "happy" | "water" | "steps" | "sleepy" | "wave" | "gym";

export const oriSrc = (pose: OriPose) => `/mascot/ori-${pose}.svg`;
