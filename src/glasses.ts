import {
  CreateStartUpPageContainer,
  OsEventTypeList,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge,
} from '@evenrealities/even_hub_sdk'

type AudioListener = (pcm: Uint8Array) => void

export async function connectGlasses(onAudio: AudioListener, onPauseToggle: () => void) {
  const bridge = await waitForEvenAppBridge()
  const status = new TextContainerProperty({
    xPosition: 0, yPosition: 0, width: 576, height: 30,
    borderWidth: 0, paddingLength: 2, containerID: 1, containerName: 'status',
    content: 'INTERVIEW COPILOT  •  LISTENING', isEventCapture: 1,
  })
  const answer = new TextContainerProperty({
    xPosition: 0, yPosition: 34, width: 576, height: 254,
    borderWidth: 0, paddingLength: 4, containerID: 2, containerName: 'answer',
    content: 'Ready. The next detected question will appear here.', isEventCapture: 0,
  })
  const result = await bridge.createStartUpPageContainer(
    new CreateStartUpPageContainer({ containerTotalNum: 2, textObject: [status, answer] }),
  )
  if (result !== 0) throw new Error(`Could not create the G2 display (${result}).`)

  let listening = true
  await bridge.audioControl(true)

  const update = async (containerID: number, containerName: string, content: string) => {
    await bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID, containerName, content }))
  }
  const setStatus = (text: string) => update(1, 'status', `INTERVIEW COPILOT  •  ${text.toUpperCase()}`)
  const setAnswer = (text: string) => update(2, 'answer', text)

  const eventTypeOf = (envelope?: { eventType?: OsEventTypeList }) =>
    envelope ? (envelope.eventType ?? OsEventTypeList.CLICK_EVENT) : null

  const unsubscribe = bridge.onEvenHubEvent(event => {
    const pcm = event.audioEvent?.audioPcm
    if (pcm && listening) onAudio(pcm)
    const sysType = eventTypeOf(event.sysEvent)
    const textType = eventTypeOf(event.textEvent)
    if (sysType === OsEventTypeList.DOUBLE_CLICK_EVENT || textType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      bridge.shutDownPageContainer(1)
    } else if (sysType === OsEventTypeList.CLICK_EVENT || textType === OsEventTypeList.CLICK_EVENT) {
      listening = !listening
      bridge.audioControl(listening)
      setStatus(listening ? 'listening' : 'paused')
      onPauseToggle()
    }
  })

  return {
    setStatus,
    setAnswer,
    setListening: async (next: boolean) => {
      listening = next
      await bridge.audioControl(next)
      await setStatus(next ? 'listening' : 'paused')
    },
    close: () => {
      bridge.audioControl(false)
      unsubscribe()
    },
  }
}
