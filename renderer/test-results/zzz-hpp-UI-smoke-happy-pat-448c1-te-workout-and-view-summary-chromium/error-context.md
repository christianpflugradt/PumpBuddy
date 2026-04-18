# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: zzz-hpp.spec.js >> UI smoke happy path > login, select plan/gym, complete workout and view summary
- Location: ui-smoke/zzz-hpp.spec.js:469:1

# Error details

```
Test timeout of 120000ms exceeded.
```

# Page snapshot

```yaml
- region "Workout exercise step" [ref=e7]:
  - generic [ref=e8]:
    - heading "Plank" [level=2] [ref=e9]
    - paragraph [ref=e10]: Plank
    - paragraph [ref=e11]: Leg Day at Downtown Dumbbell Den · 3/3
  - region "Exercise sets" [ref=e12]:
    - generic [ref=e13]:
      - heading "Current Set" [level=3] [ref=e14]
      - paragraph [ref=e15]: Set 1
    - list [ref=e16]:
      - listitem [ref=e17]:
        - generic [ref=e19]:
          - generic [ref=e20]: SECS
          - generic "Timed set controls" [ref=e21]:
            - button "Reset timer" [ref=e22] [cursor=pointer]:
              - img [ref=e23]
            - button "Set timer value" [ref=e26] [cursor=pointer]: 0:00
            - button "Start timer" [ref=e27] [cursor=pointer]:
              - img [ref=e28]
    - button "Complete Set" [disabled] [ref=e30]
    - region "Completed set history" [ref=e31]:
      - heading "History" [level=4] [ref=e32]
      - generic [ref=e33]:
        - generic [ref=e34]: Set
        - generic [ref=e35]: kg
        - generic [ref=e36]: secs
      - status [ref=e37]: No completed sets yet.
  - generic [ref=e39]:
    - button "Previous" [ref=e40] [cursor=pointer]
    - button "Finish Workout" [ref=e41] [cursor=pointer]
  - button "Cancel Workout" [ref=e43] [cursor=pointer]
```