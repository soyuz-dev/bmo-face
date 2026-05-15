import asyncio
import websockets
import json

clients = set()

async def handler(ws):
    clients.add(ws)
    print(f"Connected (total: {len(clients)})")
    try:
        async for msg in ws:
            print("Got:", msg)
    finally:
        clients.discard(ws)
        print(f"Disconnected (total: {len(clients)})")

async def main():
    async with websockets.serve(handler, "localhost", 9000):
        print("Server up — open the face, then type commands below")
        print("Commands: speak / surprised / sleepy / happy / confused / beep / processing / quit")
        print("Anything else is sent as a speak message.\n")

        loop = asyncio.get_event_loop()

        while True:
            cmd = await loop.run_in_executor(None, input, "> ")

            if cmd == "quit":
                break
            elif cmd == "speak":
                msg = {"type": "speak", "text": "I am BurdenBot."}
            elif cmd == "surprised":
                msg = {"type": "emotion", "emotion": "surprised"}
            elif cmd == "sleepy":
                msg = {"type": "emotion", "emotion": "sleepy"}
            elif cmd == "happy":
                msg = {"type": "emotion", "emotion": "happy"}
            elif cmd == "confused":
                msg = {"type": "emotion", "emotion": "confused"}
            elif cmd == "beep":
                msg = {"type": "beep"}
            elif cmd == "processing":
                msg = {"type": "processing"}
            else:
                msg = {"type": "speak", "text": cmd}

            if clients:
                await asyncio.gather(*[c.send(json.dumps(msg)) for c in clients])
                print(f"Sent to {len(clients)} client(s)")
            else:
                print("No clients connected yet")

asyncio.run(main())