import { ExhibitionScene } from '../scenes/ExhibitionScene.ts'
import { GuestbookScene } from '../scenes/GuestbookScene.ts'
import { createExhibitionShell } from '../ui/createExhibitionShell.ts'
import { EntryScreen } from '../ui/EntryScreen.ts'
import { FloatingActions } from '../ui/FloatingActions.ts'
import { LoadingScreen } from '../ui/LoadingScreen.ts'
import { ViewingGuide } from '../ui/ViewingGuide.ts'
import { GuestbookUi } from '../ui/GuestbookUi.ts'
import { PhotoPreview } from '../ui/PhotoPreview.ts'
import { composePhotoCard } from '../photo/photoCard.ts'
import { EmotionStateStore } from '../user/EmotionState.ts'
import { VisitorSession } from '../user/VisitorSession.ts'
import { GuestbookRepository, GuestbookSaveFailure, type GuestbookSaveError } from '../guestbook/GuestbookRepository.ts'
import { GUESTBOOK_CAPACITY, layoutGuestbookWall } from '../guestbook/GuestbookPlacement.ts'
import { SAMPLE_GUESTBOOK_ENTRIES } from '../guestbook/sampleEntries.ts'
import { preloadGuestbookFont } from '../guestbook/guestbookFont.ts'
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
/** 방명록 저장 실패 시 안내 문구 */
const GUESTBOOK_SAVE_MESSAGES: Readonly<Record<GuestbookSaveError, string>> = {
  'too-fast': '방명록은 30초에 한 번 남길 수 있어요. 잠시 후 다시 시도해 주세요.',
  busy: '지금 방명록이 붐벼요. 잠시 후 다시 시도해 주세요.',
  invalid: '내용을 확인해 주세요. (메시지 200자 이내)',
  network: '방명록을 저장하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.',
}

export class App {
  private readonly canvasHost: HTMLDivElement
  private readonly customizer: CustomizerScreen
  private readonly customizeButton: HTMLButtonElement
  private readonly customizationStore = new FrogCustomizationStore()
  private customizerMode: 'edit' | 'entry' = 'entry'
  private readonly entryScreen: EntryScreen
  private readonly floatingActions: FloatingActions
  private readonly emotionState = new EmotionStateStore()
  private readonly artworkViewer: ArtworkViewer
  private readonly guestbookRepository = new GuestbookRepository()
  /** 지금 방명록 방 벽에 붙어 있는 글 (자리 계산용) */
  private guestbookEntries: GuestbookEntry[] = []
  /** 지금 벽에 붙은 포스트잇 크기 (방명록이 차면 작아진다) */
  private guestbookPostitSize = 0
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
  private readonly photoButton: HTMLButtonElement
  private readonly photoPreview: PhotoPreview

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
      {
        onSelect: (roomId) => { void this.moveToRoom(roomId) },
        onGuestbook: () => { void this.enterGuestbook() },
      },
    )
    this.loadingScreen = new LoadingScreen(shell.loadingHost)
    this.floatingActions = new FloatingActions(shell.floatingActionsHost, shell.canvasHost)
    this.artworkViewer = new ArtworkViewer(shell.artworkViewerHost, (isVisible) => {
      this.scene?.setInteractionEnabled(!isVisible)
      if (isVisible) this.floatingActions.close()
    }, (artwork) => this.takePhoto(artwork.id))
    this.photoButton = shell.photoButton
    this.photoButton.addEventListener('click', () => this.takePhoto())
    this.photoPreview = new PhotoPreview(shell.photoPreviewHost, (isVisible) => {
      this.scene?.setInteractionEnabled(!isVisible)
      this.guestbookScene?.setInteractionEnabled(!isVisible)
    }, () => this.takePhoto(this.lastPhotoArtworkId))
    this.roomIntroReader = new RoomIntroReader(shell.roomIntroReaderHost, (isVisible) => {
      this.scene?.setInteractionEnabled(!isVisible)
      if (isVisible) this.floatingActions.close()
    })
    this.giftShopCard = new GiftShopCard(shell.giftShopCardHost, (isVisible) => {
      this.guestbookScene?.setInteractionEnabled(!isVisible)
      if (isVisible) this.floatingActions.close()
    })
    this.customizer = new CustomizerScreen(
      shell.customizerHost,
      (customization) => this.confirmCustomization(customization),
      () => this.cancelCustomization(),
    )
    this.customizeButton.addEventListener('click', () => this.openCustomizationEditor())
    this.guestbookUi = new GuestbookUi(
      {
        modalHost: shell.guestbookModalHost,
        returnButton: shell.guestbookReturnButton,
        toastHost: shell.toastHost,
        writeButton: shell.guestbookWriteButton,
      },
      {
        onLeave: () => { void this.returnToGallery() },
        onModalVisibility: (isVisible) => this.guestbookScene?.setInteractionEnabled(!isVisible),
        onSubmit: (message, color) => this.createGuestbookEntry(message, color),
        getAppearance: () => this.customizationStore.state,
      },
    )
    this.viewingGuide = new ViewingGuide(shell.guideHost, shell.helpButton, (isVisible) => {
      this.scene?.setInteractionEnabled(!isVisible)
      this.guestbookScene?.setInteractionEnabled(!isVisible)
    })
    this.entryScreen = new EntryScreen(shell.entryHost, this.session, (nickname) => {
      void this.enterGallery(nickname)
    })
  }

  start(): void {
    this.entryScreen.show()
  }

  private lastPhotoArtworkId: string | undefined

  /**
   * 인증샷: 전시실(작품을 고르면 그 작품과 함께)·방명록 방에서 찍는다. 영상관에서는 찍지 않는다.
   * 찍은 사진은 폴라로이드(1080×1350)로 만들어 미리보기로 보여 준다. 서버로는 보내지 않는다.
   */
  private takePhoto(artworkId?: string): void {
    if (this.sceneTransitionInProgress) return
    const photo = this.guestbookScene ? this.guestbookScene.capturePhoto() : this.scene?.capturePhoto(artworkId)
    if (!photo) return
    this.lastPhotoArtworkId = artworkId
    this.photoPreview.flash()
    void this.photoPreview.open(composePhotoCard(photo))
  }

  /** 📷 버튼은 전시실·방명록 방에서만 (영상관 제외) */
  private updatePhotoButton(): void {
    this.photoButton.hidden = !(this.guestbookScene || (this.scene && !this.currentRoomDefinition.cinema))
  }

  private async enterGallery(nickname: string): Promise<void> {
    this.session.setNickname(nickname)
    this.guestbookUi.setNickname(this.session.nickname)
    this.photoButton.hidden = true
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
      this.updatePhotoButton()
      this.customizeButton.hidden = false
      this.guestbookUi.showGalleryControls()
      this.roomSwitcher.show(this.currentRoomId)
      scene.setMinimapVisible(showMinimap)
      if (showGuide) this.viewingGuide.showAutomatically()
      else this.helpButton.hidden = false
    } catch (error) {
      console.error('Failed to initialize the exhibition scene.', error)
      this.scene?.dispose()
      this.scene = undefined
      this.photoButton.hidden = true
      this.customizeButton.hidden = true
      this.loadingScreen.showError(() => {
        void this.initializeGallery(showGuide, startAtPortalId, showMinimap)
      })
    }
  }

  private async enterGuestbook(): Promise<void> {
    if (this.sceneTransitionInProgress || !this.scene) return
    this.lastExhibitionRoomId = this.currentRoomId
    // 카드 손글씨 글꼴(약 2MB)을 지금부터 받아 둔다. 첫 로딩에는 넣지 않는다.
    preloadGuestbookFont()
    this.roomSwitcher.hide()
    this.scene?.setMinimapVisible(false)
    await this.withTransition(async () => {
      this.artworkViewer.close()
      this.roomIntroReader.close()
      this.giftShopCard.close()
      this.scene?.dispose()
      this.scene = undefined
      this.customizeButton.hidden = true
      this.guestbookUi.close()
      // 서버에서 최신 글을 불러온다. 글이 하나도 없거나 서버에 닿지 못하면 샘플 방명록을 보여준다.
      const saved = await this.guestbookRepository.loadLatest(GUESTBOOK_CAPACITY)
      if (saved === null) this.guestbookUi.toast('방명록을 불러오지 못했어요. 잠시 후 다시 들어와 주세요.')
      this.guestbookEntries = saved && saved.length > 0 ? saved : [...SAMPLE_GUESTBOOK_ENTRIES]
      const { entries, postitSize } = layoutGuestbookWall(this.guestbookEntries)
      this.guestbookPostitSize = postitSize
      this.guestbookScene = new GuestbookScene(
        this.canvasHost,
        this.session.nickname,
        this.emotionState,
        this.customizationStore.state,
        entries,
        (entry) => this.guestbookUi.showRead(
          entry,
          this.guestbookRepository.isMine(entry.id) ? () => this.deleteGuestbookEntry(entry.id) : undefined,
        ),
        (action) => {
          if (action === 'return-to-gallery') void this.returnToGallery()
          if (action === 'open-gift-shop') this.giftShopCard.open()
        },
      )
      this.guestbookScene.start()
      this.guestbookUi.showGuestbookControls()
      this.updatePhotoButton()
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

  private async createGuestbookEntry(message: string, color: GuestbookColor): Promise<boolean> {
    if (!this.guestbookScene) return false
    let saved: GuestbookEntry
    try {
      // 등록하는 순간의 꾸미기 상태를 함께 저장한다 (나중에 꾸미기를 바꿔도 이 글의 개구리는 그대로)
      saved = await this.guestbookRepository.save({ nickname: this.session.nickname, message, color, appearance: this.customizationStore.state })
    } catch (error) {
      const reason: GuestbookSaveError = error instanceof GuestbookSaveFailure ? error.reason : 'network'
      this.guestbookUi.toast(GUESTBOOK_SAVE_MESSAGES[reason])
      return false
    }
    // 샘플만 보이던 방이면 샘플을 치우지 않고 그 옆에 붙인다 (다음 입장부터는 실제 글만 보임)
    this.guestbookEntries = [...this.guestbookEntries, saved]
    // 새 글은 가장 마지막에 붙으므로 기존 글의 자리는 그대로다. 단, 벽이 차서 포스트잇 크기가 바뀌면 전부 다시 붙인다.
    const layout = layoutGuestbookWall(this.guestbookEntries)
    const entry = layout.entries.find((item) => item.id === saved.id)
    if (!this.guestbookScene || !entry) return true
    let wasAdded = true
    if (layout.postitSize !== this.guestbookPostitSize) {
      this.guestbookPostitSize = layout.postitSize
      this.guestbookScene.replaceEntries(layout.entries)
    } else {
      wasAdded = this.guestbookScene.addEntry(entry)
    }
    if (wasAdded) {
      this.guestbookScene.revealEntry(entry)
      this.guestbookUi.toast('방명록이 벽에 붙었어요.')
    }
    return true
  }

  private async deleteGuestbookEntry(entryId: string): Promise<boolean> {
    const deleted = await this.guestbookRepository.delete(entryId)
    if (!deleted) {
      this.guestbookUi.toast('방명록을 지우지 못했어요. 잠시 후 다시 시도해 주세요.')
      return false
    }
    this.guestbookEntries = this.guestbookEntries.filter((entry) => entry.id !== entryId)
    this.guestbookScene?.removeEntry(entryId)
    this.guestbookUi.toast('방명록을 지웠어요.')
    return true
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
    this.floatingActions.close()
    this.customizer.open('edit', this.customizationStore.state)
  }
}
