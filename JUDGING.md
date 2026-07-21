# Judging Lost Lessons Lab

## Demo

- URL: **<https://lost-lessons-lab.sanocks.workers.dev>**
- Direct path: `/judge`
- Login: **not required**
- Credentials: **not required**
- User API key: **not required**

## Steps

1. Open `/judge`; wait for the fresh room to load, then choose **Try the lesson as a student**.
2. Use the prepared handwritten mistake and press **Run my solution**.
3. Read the GPT-5.6 interpretation, then let the countdown start the bridge simulation.
4. After the comic failure, press **Apply prepared correction**, then press **Run my solution** again.
5. Watch the successful crossing, then press **Replay** on either simulation or reload the page to confirm persistence.

## Expected outcome

The first submission builds a `4.08 m` bridge and fails safely. The second builds a `9 m` bridge and succeeds. The page visibly connects the learner's written value to the physical result and identifies the fraction-conversion error.

## Reset

Choose **Teacher** in the persistent view control, then use **Reset current task**. Reopening `/judge` always creates a completely new room.

## Accessibility controls

Press `Tab` once from the top of the page to reveal **Skip to the learning
feed**. All actions except free-form drawing are keyboard controls, and the
prepared handwriting keeps the judge path operable without drawing. Simulation
sound starts muted and only enables after **Turn sound on** is activated. A
reduced-motion browser preference skips animation while retaining the verified
text outcome.

## AI failure fallback

If handwriting analysis fails, use **Enter the value yourself**, enter `4.08`, and press **Run manual value**. Then apply the prepared correction, enter `9`, and press **Run manual value** again. The fallback uses the same real physics scene and deterministic validation.

## Submission release

- Commit: **pending**
- Tag: `build-week-submission` **pending**
