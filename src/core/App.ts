import { ExhibitionScene } from '../scenes/ExhibitionScene.ts'
import { GuestbookScene } from '../scenes/GuestbookScene.ts'
import { createExhibitionShell } from '../ui/createExhibitionShell.ts'
import { EntryScreen } from '../ui/EntryScreen.ts'
import { EmotionPicker } from '../ui/EmotionPicker.ts'
import { LoadingScreen } from '../ui/LoadingScreen.ts'
import { ViewingGuide } from '../ui/ViewingGuide.ts'
import { GuestbookUi } from '../ui/GuestbookUi.ts'
import { EmotionStateStore } from '../user/EmotionState.ts'
import { VisitorSession } from '../user/VisitorSession.ts'
import { GuestbookRepository } from '../guestbook/GuestbookRepository.ts'
import { assignGuestbookPlacements, getFirstAvailablePlacement } from '../guestbook/GuestbookPlacement.ts'
import { SAMPLE_GUESTBOOK_ENTRIES } from '../guestbook/sampleEntries.ts'
import type { GuestbookColor, GuestbookEntry } from '../guestbook/types.ts'
import { FrogCustomizationStore } from '../characters/customization/FrogCustomizationStore.ts'
import type { FrogCustomization } from '../characters/customization/types.ts'
import { CustomizerScreen } from '../ui/CustomizerScreen.ts'
import { ArtworkViewer } from '../ui/ArtworkViewer.ts'
import { GiftShopCard } from '../ui/GiftShopCard.ts'
import { RoomIntroReader } from '../ui/RoomIntroReader.ts'
import { RoomSwitcher } from '../ui/RoomSwitcher.ts'
import { EXHIBITION_ROOMS, getExhibitionRoom } from '../rooms/roomRegistry.ts'
import type { ExhibitionRoomDefinition } from '../rooms/types.ts'
import type { PortalConfig } from '../scenes/portals/types.ts'
import { NullOccupancyProvider } from '../services/occupancy.ts'

/** Coordinates the page shell and the active 3D exhibition scene. */
export class App {
  private readonly canvasHost: HTMLDivElement
  private readonly customizer: CustomizerScreen
  private readonly customizeButton: HTMLButtonElement
  private readonly customizationStore = new FrogCustomizationStore()
  private customizerMode: 'edit' | 'entry' = 'entry'
  private readonly entryScreen: EntryScreen
  private readonly emotionPicker: EmotionPicker
  private readonly emotionState = new EmotionStateStore()
  private readonly artworkViewer: ArtworkViewer
  private readonly guestbookRepository = new GuestbookRepository()
  private readonly giftShopCard: GiftShopCard
  private readonly guestbookUi: GuestbookUi
  private readonly helpButton: HTMLButtonElement
  private readonly loadingScreen: LoadingScreen
  private readonly minimapHost: HTMLElement
  private readonly roomIntroReader: RoomIntroReader
  private readonly roomSwitcher: RoomSwitcher
  private readonly session = new VisitorSession()
  private readonly viewingGuide: ViewingGuide
  private readonly transitionHost: HTMLElement
  private readonly occupancyProvider = new NullOccupancyProvider()
  private currentRoomId = 'room-1'
  private guestbookScene: GuestbookScene | undefined
  private lastExhibitionRoomId = 'room-1'
  private scene: ExhibitionScene | undefined
  private sceneTransitionInProgress = false

  constructor(rootElement: HTMLElement) {
    const shell = createExhibitionShell(rootElement)
    this.canvasHost = shell.canvasHost
    this.customizeButton = shell.customizeButton
    this.helpButton = shell.helpButton
    this.minimapHost = shell.minimapHost
    this.transitionHost = shell.sceneTransition
    this.roomSwitcher = new RoomSwitcher(
      shell.roomSwitcherHost,
      EXHIBITION_ROOMS,
      this.occupancyProvider,
      { onSelect: (roomId) => { void this.moveToRoom(roomId) } },
    )
    this.loadingScreen = new LoadingScreen(shell.loadingHost)
    this.emotionPicker = new EmotionPicker(shell.emotionHost, (emotion) => {
      this.emotionState.select(emotion)
    })
    this.artworkViewer = new ArtworkViewer(shell.artworkViewerHost, (isVisible) => {
      this.scene?.setInteractionEnabled(!isVisible)
      if (isVisible) this.emotionPicker.close()
    })
    this.roomIntroReader = new RoomIntroReader(shell.roomIntroReaderHost, (isVisible) => {
      this.scene?.setInteractionEnabled(!isVisible)
      if (isVisible) this.emotionPicker.close()
    })
    this.giftShopCard = new GiftShopCard(shell.giftShopCardHost, (isVisible) => {
      this.guestbookScene?.setInteractionEnabled(!isVisible)
      if (isVisible) this.emotionPicker.close()
    })
    this.customizer = new CustomizerScreen(
      shell.customizerHost,
      (customization) => this.confirmCustomization(customization),
      () => this.cancelCustomization(),
    )
    this.customizeButton.addEventListener('click', () => this.openCustomizationEditor())
    this.guestbookUi = new GuestbookUi(
      {
        galleryButton: shell.galleryGuestbookButton,
        modalHost: shell.guestbookModalHost,
        returnButton: shell.guestbookReturnButton,
        toastHost: shell.toastHost,
        writeButton: shell.guestbookWriteButton,
      },
      {
        onEnter: () => { void this.enterGuestbook() },
        onLeave: () => { void this.returnToGallery() },
        onModalVisibility: (isVisible) => this.guestbookScene?.setInteractionEnabled(!isVisible),
        onSubmit: (message, color) => this.createGuestbookEntry(message, color),
      },
    )
    this.viewingGuide = new ViewingGuide(shell.guideHost, shell.helpButton, (isVisible) => {
      this.scene?.setInteractionEnabled(!isVisible)
      if (isVisible) {
        this.emotionPicker.close()
      }
    })
    this.entryScreen = new EntryScreen(shell.entryHost, this.session, (nickname) => {
      void this.enterGallery(nickname)
    })
  }

  start(): void {
    this.entryScreen.show()
  }

  private async enterGallery(nickname: string): Promise<void> {
    this.session.setNickname(nickname)
    this.guestbookUi.setNickname(this.session.nickname)
    this.emotionPicker.hide()
    this.entryScreen.hide()
    this.customizerMode = 'entry'
    this.customizer.open('entry', this.customizationStore.state)
  }

  private async initializeGallery(
    showGuide: boolean,
    startAtPortalId: string | undefined = undefined,
    showMinimap = true,
  ): Promise<void> {
    const roomDefinition = this.currentRoomDefinition
    this.loadingScreen.show()

    // Gives the browser a paint opportunity for the loading state without adding a timed delay.
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))

    try {
      this.scene?.dispose()
      this.scene = undefined

      const scene = new ExhibitionScene(
        this.canvasHost,
        this.session.nickname,
        this.emotionState,
        this.customizationStore.state,
        roomDefinition,
        (artwork) => this.artworkViewer.open(artwork),
        (intro) => this.roomIntroReader.open(intro),
        (portal) => this.handleExhibitionPortal(portal),
        this.minimapHost,
        this.occupancyProvider,
        { startAt: startAtPortalId ? { portalId: startAtPortalId } : 'spawn' },
      )
      scene.start()
      this.scene = scene
      this.loadingScreen.hide()
      this.emotionPicker.show()
      this.customizeButton.hidden = false
      this.guestbookUi.showGalleryControls()
      this.roomSwitcher.show(this.currentRoomId)
      scene.setMinimapVisible(showMinimap)
      if (showGuide) this.viewingGuide.show()
      else this.helpButton.hidden = false
    } catch (error) {
      console.error('Failed to initialize the exhibition scene.', error)
      this.scene?.dispose()
      this.scene = undefined
      this.emotionPicker.hide()
      this.customizeButton.hidden = true
      this.loadingScreen.showError(() => {
        void this.initializeGallery(showGuide, startAtPortalId, showMinimap)
      })
    }
  }

  private async enterGuestbook(): Promise<void> {
    if (this.sceneTransitionInProgress || !this.scene) return
    this.lastExhibitionRoomId = this.currentRoomId
    this.roomSwitcher.hide()
    this.scene?.setMinimapVisible(false)
    await this.withTransition(async () => {
      this.artworkViewer.close()
      this.roomIntroReader.close()
      this.giftShopCard.close()
      this.scene?.dispose()
      this.scene = undefined
      this.helpButton.hidden = true
      this.customizeButton.hidden = true
      this.guestbookUi.close()
      const entries = assignGuestbookPlacements([...SAMPLE_GUESTBOOK_ENTRIES, ...this.guestbookRepository.load()])
      this.guestbookScene = new GuestbookScene(
        this.canvasHost,
        this.session.nickname,
        this.emotionState,
        this.customizationStore.state,
        entries,
        (entry) => this.guestbookUi.showRead(entry),
        (action) => {
          if (action === 'return-to-gallery') void this.returnToGallery()
          if (action === 'open-gift-shop') this.giftShopCard.open()
        },
      )
      this.guestbookScene.start()
      this.guestbookUi.showGuestbookControls()
    })
  }

  private async returnToGallery(): Promise<void> {
    if (this.sceneTransitionInProgress) return
    this.guestbookUi.close()
    this.giftShopCard.close()
    const returningRoom = getExhibitionRoom(this.lastExhibitionRoomId) ?? EXHIBITION_ROOMS[0]
    this.currentRoomId = returningRoom.id
    const arrivalPortalId = this.findPortalId(returningRoom, (portal) => portal.action === 'enter-guestbook')
    await this.withTransition(async () => {
      this.guestbookScene?.dispose()
      this.guestbookScene = undefined
      await this.initializeGallery(false, arrivalPortalId, false)
    })
    this.scene?.setMinimapVisible(true)
  }

  private async moveToRoom(targetRoomId: string): Promise<void> {
    const destinationRoom = getExhibitionRoom(targetRoomId)
    if (!destinationRoom || targetRoomId === this.currentRoomId || this.sceneTransitionInProgress || !this.scene) return

    const sourceRoomId = this.currentRoomId
    const arrivalPortalId = this.findPortalId(
      destinationRoom,
      (portal) => portal.action === 'go-to-room' && portal.targetRoomId === sourceRoomId,
    )
    this.roomSwitcher.hide()
    this.scene.cancelInteractions()
    this.scene.setMinimapVisible(false)
    await this.withTransition(async () => {
      this.artworkViewer.close()
      this.roomIntroReader.close()
      this.currentRoomId = destinationRoom.id
      await this.initializeGallery(false, arrivalPortalId)
    })
  }

  private handleExhibitionPortal(portal: PortalConfig): void {
    if (portal.action === 'enter-guestbook') {
      void this.enterGuestbook()
    } else if (portal.action === 'go-to-room' && portal.targetRoomId) {
      void this.moveToRoom(portal.targetRoomId)
    }
  }

  private get currentRoomDefinition(): ExhibitionRoomDefinition {
    return getExhibitionRoom(this.currentRoomId) ?? EXHIBITION_ROOMS[0]
  }

  private findPortalId(
    room: ExhibitionRoomDefinition,
    predicate: (portal: PortalConfig) => boolean,
  ): string | undefined {
    return room.portals.find(predicate)?.id
  }

  private createGuestbookEntry(message: string, color: GuestbookColor): boolean {
    if (!this.guestbookScene) return false
    const existing = assignGuestbookPlacements([...SAMPLE_GUESTBOOK_ENTRIES, ...this.guestbookRepository.load()])
    const placement = getFirstAvailablePlacement(existing)
    if (!placement) {
      this.guestbookUi.toast('현재 전시실의 포스트잇 자리가 모두 찼습니다.')
      return false
    }
    const entry: GuestbookEntry = {
      id: globalThis.crypto?.randomUUID?.() ?? `guestbook-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      nickname: this.session.nickname,
      message,
      color,
      createdAt: new Date().toISOString(),
      placement,
    }
    this.guestbookRepository.save(entry)
    const wasAdded = this.guestbookScene.addEntry(entry)
    if (wasAdded) {
      this.guestbookScene.revealEntry(entry)
      this.guestbookUi.toast('방명록이 벽에 붙었어요.')
    }
    return wasAdded
  }

  private async withTransition(task: () => Promise<void> | void): Promise<void> {
    if (this.sceneTransitionInProgress) return
    this.sceneTransitionInProgress = true
    this.transitionHost.hidden = false
    try {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
      this.transitionHost.classList.add('scene-transition--visible')
      await new Promise<void>((resolve) => window.setTimeout(resolve, 160))
      await task()
      this.transitionHost.classList.remove('scene-transition--visible')
      await new Promise<void>((resolve) => window.setTimeout(resolve, 180))
      this.transitionHost.hidden = true
    } finally {
      this.sceneTransitionInProgress = false
    }
  }

  private confirmCustomization(customization: FrogCustomization): void {
    this.customizationStore.save(customization)
    if (this.customizerMode === 'entry') {
      void this.initializeGallery(true)
      return
    }
    this.scene?.applyCustomization(customization)
    this.scene?.setInteractionEnabled(true)
    this.scene?.setMinimapVisible(true)
    this.customizeButton.hidden = false
    this.roomSwitcher.show(this.currentRoomId)
  }

  private cancelCustomization(): void {
    if (this.customizerMode !== 'edit') return
    this.scene?.setInteractionEnabled(true)
    this.scene?.setMinimapVisible(true)
    this.customizeButton.hidden = false
    this.roomSwitcher.show(this.currentRoomId)
  }

  private openCustomizationEditor(): void {
    if (!this.scene) return
    this.customizerMode = 'edit'
    this.scene.setInteractionEnabled(false)
    this.scene.setMinimapVisible(false)
    this.customizeButton.hidden = true
    this.roomSwitcher.hide()
    this.emotionPicker.close()
    this.customizer.open('edit', this.customizationStore.state)
  }
}
