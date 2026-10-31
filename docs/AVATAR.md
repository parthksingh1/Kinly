# The companion on screen

## Default: Kinly's own companion
The elder screen draws an original companion (`family-app/src/components/companion-face.tsx`): a calm evergreen sphere with warm cream features. It is not an anime character or a cartoon person, and it is fully licensed (we drew it).
- **Lip sync:** the server sends a volume value for every 20 ms of speech, and the mouth opens with it.
- **Expressions:** the brain tags sentences `[happy] [laughing] [concerned] [listening] [surprised]`, which arrive as `actions.expressions[0]`.
- **Idle:** slow breathing, natural blinking, a voice halo while speaking. All motion respects *reduced motion*.

## Using a licensed Live2D model instead
The backend still emits Live2D expression indices (the second entry of `actions.expressions`, mapped through `model_dict.json`'s `emotionMap`).
1. Put the model folder in `live2d-models/<name>/` and add it to `model_dict.json` with an `emotionMap` that has `neutral, joy, sadness, surprise` keys.
2. Set `live2d_model_name: '<name>'` in `conf.yaml`.
3. In the elder screen, replace `<CompanionFace>` with a Live2D renderer (`pixi-live2d-display` + Cubism Core). Drive `ParamMouthOpenY` from `mouth`, and call `model.expression(index)` with the numeric expression.
4. Keep the **AI** badge visible.

## Family Avatar (Premium)
When an approved Family Avatar is on, the screen shows the person's chosen photo in a frame labelled **"AI · Riya's voice"**, and speech uses their consented cloned voice (Cartesia). The avatar always introduces itself as an AI voice. The consent flow lives in the family app (`/dashboard/avatar`); the rules are in [README](../README.md#safety-consent-and-dignity).
