import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type LanguageCode = 'en-US' | 'es' | 'fr' | 'de' | 'pt' | 'zh' | 'ja' | 'ko';

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en-US', label: 'English (US)', nativeLabel: 'English (US)' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español' },
  { code: 'fr', label: 'French', nativeLabel: 'Français' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch' },
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Português' },
  { code: 'zh', label: 'Chinese (Simplified)', nativeLabel: '简体中文' },
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語' },
  { code: 'ko', label: 'Korean', nativeLabel: '한국어' },
];

export const LANGUAGE_MAP: Record<string, LanguageOption> = SUPPORTED_LANGUAGES.reduce(
  (map, lang) => { map[lang.code] = lang; return map; },
  {} as Record<string, LanguageOption>
);

type TranslationDict = Record<string, string>;

const enUS: TranslationDict = {
  // Kiosk - Attract
  'kiosk.tapToStart': 'TAP TO START',
  'kiosk.aiPhotoExperience': 'AI Photo Experience',
  'kiosk.checkingCredits': 'Checking credits...',
  'kiosk.photosRemaining': 'photos remaining on this device',
  'kiosk.photoRemaining': 'photo remaining on this device',
  'kiosk.exitKiosk': 'Exit Kiosk',

  // Kiosk - No Credits
  'kiosk.outOfCredits': 'OUT OF CREDITS',
  'kiosk.outOfCreditsDesc': 'This event has run out of image generation credits',
  'kiosk.upgradeSubscription': 'Upgrade Subscription',
  'kiosk.purchaseCredits': 'Purchase Credits',
  'kiosk.needHelp': 'Need help?',
  'kiosk.contactOrganizer': 'Contact the event organizer or visit your account dashboard to manage your credits and subscription.',

  // Kiosk - Device Limit
  'kiosk.photoLimitReached': 'PHOTO LIMIT REACHED',
  'kiosk.deviceLimitDesc': 'This device has already taken its allowed number of photos for this event',
  'kiosk.limit': 'Limit:',
  'kiosk.photoPerDevice': 'photo per device',
  'kiosk.photosPerDevice': 'photos per device',
  'kiosk.askOrganizer': 'Please ask the event organizer if you need assistance.',

  // Kiosk - Prompt Select
  'kiosk.chooseYourStyle': 'Choose Your Style',
  'kiosk.cancel': 'Cancel',
  'kiosk.back': 'Back',

  // Kiosk - Camera
  'kiosk.switchCamera': 'Switch to back camera',
  'kiosk.switchToFront': 'Switch to front camera',

  // Kiosk - Processing
  'kiosk.creatingMagic': 'Creating Magic...',
  'kiosk.applyingStyle': 'Applying {style} style',
  'kiosk.uploadingImage': 'Uploading image...',

  // Kiosk - Review
  'kiosk.lookGood': 'Look Good?',
  'kiosk.retake': 'Retake',
  'kiosk.generateAI': 'Generate AI',

  // Kiosk - Result/Delivery
  'kiosk.getYourPhoto': 'Get Your Photo',
  'kiosk.downloadNowOrSent': 'Download now or get it sent to you.',
  'kiosk.downloadNow': 'Download now (sharing unavailable)',
  'kiosk.getItSent': 'Get it sent to you below.',
  'kiosk.downloadNowBtn': 'Download Now',
  'kiosk.downloadPhoto': 'Download Photo',
  'kiosk.orGetItSent': 'or get it sent to you',
  'kiosk.sms': 'SMS',
  'kiosk.sendSms': 'Send SMS',
  'kiosk.sendViaWhatsApp': 'Send via WhatsApp',
  'kiosk.whatsappConsent': 'By selecting Send, you agree to receive this photo link from Fun Frame Photo via WhatsApp.',
  'kiosk.email': 'Email',
  'kiosk.sendViaEmail': 'Send via Email',
  'kiosk.preparingLink': 'Preparing link...',
  'kiosk.sending': 'Sending...',
  'kiosk.scanForInstantAccess': 'Scan for Instant Access',
  'kiosk.noPhoneRequired': 'No phone number required',
  'kiosk.viewEventGallery': 'View Event Gallery',
  'kiosk.skipStartOver': 'Skip & Start Over',
  'kiosk.startOverNow': 'Start Over Now',
  'kiosk.sent': 'Sent!',
  'kiosk.checkYourPhone': 'Check your phone for the link.',
  'kiosk.sendToAnother': 'Send to Another',
  'kiosk.startingOverIn': 'Starting over in {seconds} seconds...',
  'kiosk.wantToCreate': 'Want to create your own prompts and events?',
  'kiosk.getYourOwnAccount': 'Get Your Own Account Now',
  'kiosk.longPressToSave': 'Long-press to save',
  'kiosk.tapToReturnFullscreen': 'Tap to Return to Fullscreen',
  'kiosk.returnToFullscreen': 'Return to Fullscreen',
  'kiosk.fullscreenPrompt': 'For the best experience, tap anywhere to return to fullscreen mode.',
  'kiosk.enterPasscode': 'Enter Passcode',
  'kiosk.enterPasscodeDesc': 'Enter the passcode to exit the kiosk.',
  'kiosk.incorrectPasscode': 'Incorrect passcode. Please try again.',
  'kiosk.loading': 'Loading...',

  // Kiosk - Event Time States
  'kiosk.eventNotStarted': 'EVENT NOT STARTED',
  'kiosk.eventNotStartedDesc': 'This event has not started yet',
  'kiosk.eventStarts': 'Event starts:',
  'kiosk.eventHasEnded': 'EVENT HAS ENDED',
  'kiosk.eventConcluded': 'This event has concluded',
  'kiosk.eventEnded': 'Event ended:',
  'kiosk.thankYou': 'Thank you for participating!',
  'kiosk.upgradePrompt': 'Please upgrade your subscription or purchase additional credits to continue using the photo booth.',

  // Settings - Account Language
  'settings.accountLanguage': 'Account Language',
  'settings.accountLanguageDesc': 'Choose the language for your dashboard and admin interface.',
  'settings.saved': 'Settings saved successfully.',
  'settings.saveFailed': 'Failed to save settings. Please try again.',
  'settings.saving': 'Saving...',

  // Event Editor - Language Modal
  'event.languageSettings': 'Language Settings',
  'event.kioskLanguage': 'Kiosk Language',
  'event.kioskLanguageDesc': 'Choose the language guests will see on the kiosk screen for this event.',
  'event.promptTranslations': 'Prompt Translations',
  'event.promptTranslationsDesc': 'Translate your prompt names and descriptions for guests. Click auto-translate to generate translations, then edit as needed.',
  'event.autoTranslateAll': 'Auto-Translate All',
  'event.translating': 'Translating...',
  'event.translate': 'Translate',
  'event.englishSource': 'English (Source)',
  'event.save': 'Save',
  'event.cancel': 'Cancel',
  'event.close': 'Close',
  'event.manageLanguage': 'Manage Language',

  // Prompt Library - Translations
  'promptLibrary.translations': 'Translations',
  'promptLibrary.translationsDesc': 'Provide translated names and descriptions for this prompt in other languages.',
  'promptLibrary.autoTranslate': 'Auto-Translate',
  'promptLibrary.translating': 'Translating...',
  'promptLibrary.saveTranslations': 'Save Translations',
  'promptLibrary.translationsSaved': 'Translations saved.',
};

const es: TranslationDict = {
  'kiosk.tapToStart': 'TOCA PARA COMENZAR',
  'kiosk.aiPhotoExperience': 'Experiencia Foto IA',
  'kiosk.checkingCredits': 'Verificando créditos...',
  'kiosk.photosRemaining': 'fotos restantes en este dispositivo',
  'kiosk.photoRemaining': 'foto restante en este dispositivo',
  'kiosk.exitKiosk': 'Salir del quiosco',

  'kiosk.outOfCredits': 'SIN CRÉDITOS',
  'kiosk.outOfCreditsDesc': 'Este evento se ha quedado sin créditos de generación de imágenes',
  'kiosk.upgradeSubscription': 'Mejorar Suscripción',
  'kiosk.purchaseCredits': 'Comprar Créditos',
  'kiosk.needHelp': '¿Necesitas ayuda?',
  'kiosk.contactOrganizer': 'Contacta al organizador del evento o visita el panel de tu cuenta para gestionar tus créditos y suscripción.',

  'kiosk.photoLimitReached': 'LÍMITE DE FOTOS ALCANZADO',
  'kiosk.deviceLimitDesc': 'Este dispositivo ya ha tomado la cantidad permitida de fotos para este evento',
  'kiosk.limit': 'Límite:',
  'kiosk.photoPerDevice': 'foto por dispositivo',
  'kiosk.photosPerDevice': 'fotos por dispositivo',
  'kiosk.askOrganizer': 'Pide ayuda al organizador del evento si la necesitas.',

  'kiosk.chooseYourStyle': 'Elige Tu Estilo',
  'kiosk.cancel': 'Cancelar',
  'kiosk.back': 'Atrás',

  'kiosk.switchCamera': 'Cambiar a cámara trasera',
  'kiosk.switchToFront': 'Cambiar a cámara frontal',

  'kiosk.creatingMagic': 'Creando Magia...',
  'kiosk.applyingStyle': 'Aplicando estilo {style}',
  'kiosk.uploadingImage': 'Subiendo imagen...',

  'kiosk.lookGood': '¿Se Ve Bien?',
  'kiosk.retake': 'Tomar de Nuevo',
  'kiosk.generateAI': 'Generar IA',

  'kiosk.getYourPhoto': 'Obtén Tu Foto',
  'kiosk.downloadNowOrSent': 'Descarga ahora o recíbela por mensaje.',
  'kiosk.downloadNow': 'Descarga ahora (envío no disponible)',
  'kiosk.getItSent': 'Recíbela por mensaje abajo.',
  'kiosk.downloadNowBtn': 'Descargar Ahora',
  'kiosk.downloadPhoto': 'Descargar Foto',
  'kiosk.orGetItSent': 'o recíbela por mensaje',
  'kiosk.sms': 'SMS',
  'kiosk.sendSms': 'Enviar SMS',
  'kiosk.sendViaWhatsApp': 'Enviar por WhatsApp',
  'kiosk.whatsappConsent': 'Al seleccionar Enviar, aceptas recibir este enlace de foto de Fun Frame Photo por WhatsApp.',
  'kiosk.email': 'Correo',
  'kiosk.sendViaEmail': 'Enviar por Correo',
  'kiosk.preparingLink': 'Preparando enlace...',
  'kiosk.sending': 'Enviando...',
  'kiosk.scanForInstantAccess': 'Escanea para Acceso Instantáneo',
  'kiosk.noPhoneRequired': 'No se requiere número de teléfono',
  'kiosk.viewEventGallery': 'Ver Galería del Evento',
  'kiosk.skipStartOver': 'Saltar y Comenzar de Nuevo',
  'kiosk.startOverNow': 'Comenzar de Nuevo',
  'kiosk.sent': '¡Enviado!',
  'kiosk.checkYourPhone': 'Revisa tu teléfono para el enlace.',
  'kiosk.sendToAnother': 'Enviar a Otro',
  'kiosk.startingOverIn': 'Comenzando de nuevo en {seconds} segundos...',
  'kiosk.wantToCreate': '¿Quieres crear tus propios prompts y eventos?',
  'kiosk.getYourOwnAccount': 'Obtén Tu Propia Cuenta Ahora',
  'kiosk.longPressToSave': 'Mantén presionado para guardar',
  'kiosk.tapToReturnFullscreen': 'Toca para Volver a Pantalla Completa',
  'kiosk.returnToFullscreen': 'Volver a Pantalla Completa',
  'kiosk.fullscreenPrompt': 'Para la mejor experiencia, toca en cualquier lugar para volver a pantalla completa.',
  'kiosk.loading': 'Cargando...',

  'kiosk.eventNotStarted': 'EVENTO NO INICIADO',
  'kiosk.eventNotStartedDesc': 'Este evento aún no ha comenzado',
  'kiosk.eventStarts': 'El evento comienza:',
  'kiosk.eventHasEnded': 'EL EVENTO HA TERMINADO',
  'kiosk.eventConcluded': 'Este evento ha concluido',
  'kiosk.eventEnded': 'El evento terminó:',
  'kiosk.thankYou': '¡Gracias por participar!',
  'kiosk.upgradePrompt': 'Por favor, mejore su suscripción o compre créditos adicionales para continuar usando la cabina de fotos.',

  'settings.accountLanguage': 'Idioma de la Cuenta',
  'settings.accountLanguageDesc': 'Elige el idioma para tu panel y interfaz de administración.',
  'settings.saved': 'Configuración guardada con éxito.',
  'settings.saveFailed': 'Error al guardar la configuración. Inténtalo de nuevo.',
  'settings.saving': 'Guardando...',

  'event.languageSettings': 'Configuración de Idioma',
  'event.kioskLanguage': 'Idioma del Quiosco',
  'event.kioskLanguageDesc': 'Elige el idioma que los invitados verán en la pantalla del quiosco para este evento.',
  'event.promptTranslations': 'Traducciones de Prompts',
  'event.promptTranslationsDesc': 'Traduce los nombres y descripciones de tus prompts para los invitados. Haz clic en auto-traducir para generar traducciones, luego edita según sea necesario.',
  'event.autoTranslateAll': 'Auto-Traducir Todo',
  'event.translating': 'Traduciendo...',
  'event.translate': 'Traducir',
  'event.englishSource': 'Inglés (Origen)',
  'event.save': 'Guardar',
  'event.cancel': 'Cancelar',
  'event.close': 'Cerrar',
  'event.manageLanguage': 'Gestionar Idioma',

  'promptLibrary.translations': 'Traducciones',
  'promptLibrary.translationsDesc': 'Proporciona nombres y descripciones traducidos para este prompt en otros idiomas.',
  'promptLibrary.autoTranslate': 'Auto-Traducir',
  'promptLibrary.translating': 'Traduciendo...',
  'promptLibrary.saveTranslations': 'Guardar Traducciones',
  'promptLibrary.translationsSaved': 'Traducciones guardadas.',
};

const fr: TranslationDict = {
  'kiosk.tapToStart': 'TOUCHEZ POUR COMMENCER',
  'kiosk.aiPhotoExperience': 'Expérience Photo IA',
  'kiosk.checkingCredits': 'Vérification des crédits...',
  'kiosk.photosRemaining': 'photos restantes sur cet appareil',
  'kiosk.photoRemaining': 'photo restante sur cet appareil',
  'kiosk.exitKiosk': 'Quitter la borne',

  'kiosk.outOfCredits': 'PLUS DE CRÉDITS',
  'kiosk.outOfCreditsDesc': 'Cet événement n\'a plus de crédits de génération d\'images',
  'kiosk.upgradeSubscription': 'Améliorer l\'Abonnement',
  'kiosk.purchaseCredits': 'Acheter des Crédits',
  'kiosk.needHelp': 'Besoin d\'aide ?',
  'kiosk.contactOrganizer': 'Contactez l\'organisateur de l\'événement ou visitez votre tableau de bord pour gérer vos crédits et abonnement.',

  'kiosk.photoLimitReached': 'LIMITE DE PHOTOS ATTEINTE',
  'kiosk.deviceLimitDesc': 'Cet appareil a déjà pris le nombre de photos autorisé pour cet événement',
  'kiosk.limit': 'Limite :',
  'kiosk.photoPerDevice': 'photo par appareil',
  'kiosk.photosPerDevice': 'photos par appareil',
  'kiosk.askOrganizer': 'Demandez à l\'organisateur de l\'événement si vous avez besoin d\'aide.',

  'kiosk.chooseYourStyle': 'Choisissez Votre Style',
  'kiosk.cancel': 'Annuler',
  'kiosk.back': 'Retour',

  'kiosk.switchCamera': 'Passer à la caméra arrière',
  'kiosk.switchToFront': 'Passer à la caméra frontale',

  'kiosk.creatingMagic': 'Création de Magie...',
  'kiosk.applyingStyle': 'Application du style {style}',
  'kiosk.uploadingImage': 'Téléchargement de l\'image...',

  'kiosk.lookGood': 'Ça Vous Va ?',
  'kiosk.retake': 'Reprendre',
  'kiosk.generateAI': 'Générer IA',

  'kiosk.getYourPhoto': 'Obtenez Votre Photo',
  'kiosk.downloadNowOrSent': 'Téléchargez maintenant ou recevez-la par message.',
  'kiosk.downloadNow': 'Téléchargez maintenant (partage indisponible)',
  'kiosk.getItSent': 'Recevez-la par message ci-dessous.',
  'kiosk.downloadNowBtn': 'Télécharger Maintenant',
  'kiosk.downloadPhoto': 'Télécharger la Photo',
  'kiosk.orGetItSent': 'ou recevez-la par message',
  'kiosk.sms': 'SMS',
  'kiosk.sendSms': 'Envoyer par SMS',
  'kiosk.sendViaWhatsApp': 'Envoyer par WhatsApp',
  'kiosk.whatsappConsent': 'En sélectionnant Envoyer, vous acceptez de recevoir ce lien photo de Fun Frame Photo par WhatsApp.',
  'kiosk.email': 'E-mail',
  'kiosk.sendViaEmail': 'Envoyer par E-mail',
  'kiosk.preparingLink': 'Préparation du lien...',
  'kiosk.sending': 'Envoi...',
  'kiosk.scanForInstantAccess': 'Scannez pour un Accès Instantané',
  'kiosk.noPhoneRequired': 'Aucun numéro de téléphone requis',
  'kiosk.viewEventGallery': 'Voir la Galerie de l\'Événement',
  'kiosk.skipStartOver': 'Passer et Recommencer',
  'kiosk.startOverNow': 'Recommencer Maintenant',
  'kiosk.sent': 'Envoyé !',
  'kiosk.checkYourPhone': 'Vérifiez votre téléphone pour le lien.',
  'kiosk.sendToAnother': 'Envoyer à un Autre',
  'kiosk.startingOverIn': 'Recommencement dans {seconds} secondes...',
  'kiosk.wantToCreate': 'Vous voulez créer vos propres prompts et événements ?',
  'kiosk.getYourOwnAccount': 'Obtenez Votre Propre Compte Maintenant',
  'kiosk.longPressToSave': 'Maintenez pour enregistrer',
  'kiosk.tapToReturnFullscreen': 'Touchez pour Revenir en Plein Écran',
  'kiosk.returnToFullscreen': 'Revenir en Plein Écran',
  'kiosk.fullscreenPrompt': 'Pour une meilleure expérience, touchez n\'importe où pour revenir en plein écran.',
  'kiosk.loading': 'Chargement...',

  'kiosk.eventNotStarted': 'ÉVÉNEMENT NON COMMENCÉ',
  'kiosk.eventNotStartedDesc': 'Cet événement n\'a pas encore commencé',
  'kiosk.eventStarts': 'L\'événement commence :',
  'kiosk.eventHasEnded': 'L\'ÉVÉNEMENT EST TERMINÉ',
  'kiosk.eventConcluded': 'Cet événement est terminé',
  'kiosk.eventEnded': 'L\'événement s\'est terminé :',
  'kiosk.thankYou': 'Merci d\'avoir participé !',
  'kiosk.upgradePrompt': 'Veuillez mettre à niveau votre abonnement ou acheter des crédits supplémentaires pour continuer à utiliser la borne photo.',

  'settings.accountLanguage': 'Langue du Compte',
  'settings.accountLanguageDesc': 'Choisissez la langue de votre tableau de bord et interface d\'administration.',
  'settings.saved': 'Paramètres enregistrés avec succès.',
  'settings.saveFailed': 'Échec de l\'enregistrement des paramètres. Réessayez.',
  'settings.saving': 'Enregistrement...',

  'event.languageSettings': 'Paramètres de Langue',
  'event.kioskLanguage': 'Langue de la Borne',
  'event.kioskLanguageDesc': 'Choisissez la langue que les invités verront sur l\'écran de la borne pour cet événement.',
  'event.promptTranslations': 'Traductions des Prompts',
  'event.promptTranslationsDesc': 'Traduisez les noms et descriptions de vos prompts pour les invités. Cliquez sur auto-traduire pour générer des traductions, puis modifiez-les selon vos besoins.',
  'event.autoTranslateAll': 'Tout Auto-Traduire',
  'event.translating': 'Traduction...',
  'event.translate': 'Traduire',
  'event.englishSource': 'Anglais (Source)',
  'event.save': 'Enregistrer',
  'event.cancel': 'Annuler',
  'event.close': 'Fermer',
  'event.manageLanguage': 'Gérer la Langue',

  'promptLibrary.translations': 'Traductions',
  'promptLibrary.translationsDesc': 'Fournissez des noms et descriptions traduits pour ce prompt dans d\'autres langues.',
  'promptLibrary.autoTranslate': 'Auto-Traduire',
  'promptLibrary.translating': 'Traduction...',
  'promptLibrary.saveTranslations': 'Enregistrer les Traductions',
  'promptLibrary.translationsSaved': 'Traductions enregistrées.',
};

const de: TranslationDict = {
  'kiosk.tapToStart': 'TIPPEN ZUM STARTEN',
  'kiosk.aiPhotoExperience': 'KI Foto-Erlebnis',
  'kiosk.checkingCredits': 'Guthaben wird geprüft...',
  'kiosk.photosRemaining': 'Fotos verbleibend auf diesem Gerät',
  'kiosk.photoRemaining': 'Foto verbleibend auf diesem Gerät',
  'kiosk.exitKiosk': 'Kiosk verlassen',

  'kiosk.outOfCredits': 'KEIN GUTHABEN',
  'kiosk.outOfCreditsDesc': 'Dieses Event hat keine Bildgenerierungsguthaben mehr',
  'kiosk.upgradeSubscription': 'Abonnement upgraden',
  'kiosk.purchaseCredits': 'Guthaben kaufen',
  'kiosk.needHelp': 'Hilfe nötig?',
  'kiosk.contactOrganizer': 'Kontaktieren Sie den Event-Organisator oder besuchen Sie Ihr Konto-Dashboard, um Guthaben und Abonnement zu verwalten.',

  'kiosk.photoLimitReached': 'FOTOLIMIT ERREICHT',
  'kiosk.deviceLimitDesc': 'Dieses Gerät hat bereits die erlaubte Anzahl an Fotos für dieses Event aufgenommen',
  'kiosk.limit': 'Limit:',
  'kiosk.photoPerDevice': 'Foto pro Gerät',
  'kiosk.photosPerDevice': 'Fotos pro Gerät',
  'kiosk.askOrganizer': 'Bitte wenden Sie sich an den Event-Organisator, wenn Sie Hilfe benötigen.',

  'kiosk.chooseYourStyle': 'Wählen Sie Ihren Stil',
  'kiosk.cancel': 'Abbrechen',
  'kiosk.back': 'Zurück',

  'kiosk.switchCamera': 'Zur Rückkamera wechseln',
  'kiosk.switchToFront': 'Zur Frontkamera wechseln',

  'kiosk.creatingMagic': 'Magie wird erschaffen...',
  'kiosk.applyingStyle': 'Stil {style} wird angewendet',
  'kiosk.uploadingImage': 'Bild wird hochgeladen...',

  'kiosk.lookGood': 'Gut Aussehen?',
  'kiosk.retake': 'Neu aufnehmen',
  'kiosk.generateAI': 'KI generieren',

  'kiosk.getYourPhoto': 'Holen Sie Ihr Foto',
  'kiosk.downloadNowOrSent': 'Jetzt herunterladen oder zusenden lassen.',
  'kiosk.downloadNow': 'Jetzt herunterladen (Teilen nicht verfügbar)',
  'kiosk.getItSent': 'Lassen Sie es sich unten zusenden.',
  'kiosk.downloadNowBtn': 'Jetzt herunterladen',
  'kiosk.downloadPhoto': 'Foto herunterladen',
  'kiosk.orGetItSent': 'oder zusenden lassen',
  'kiosk.sms': 'SMS',
  'kiosk.sendSms': 'SMS senden',
  'kiosk.sendViaWhatsApp': 'Per WhatsApp senden',
  'kiosk.whatsappConsent': 'Durch Auswahl von Senden stimmen Sie zu, diesen Foto-Link von Fun Frame Photo per WhatsApp zu erhalten.',
  'kiosk.email': 'E-Mail',
  'kiosk.sendViaEmail': 'Per E-Mail senden',
  'kiosk.preparingLink': 'Link wird vorbereitet...',
  'kiosk.sending': 'Wird gesendet...',
  'kiosk.scanForInstantAccess': 'Scannen für Sofortzugriff',
  'kiosk.noPhoneRequired': 'Keine Telefonnummer erforderlich',
  'kiosk.viewEventGallery': 'Event-Galerie ansehen',
  'kiosk.skipStartOver': 'Überspringen & Neu starten',
  'kiosk.startOverNow': 'Jetzt neu starten',
  'kiosk.sent': 'Gesendet!',
  'kiosk.checkYourPhone': 'Prüfen Sie Ihr Telefon auf den Link.',
  'kiosk.sendToAnother': 'An eine andere Person senden',
  'kiosk.startingOverIn': 'Neustart in {seconds} Sekunden...',
  'kiosk.wantToCreate': 'Möchten Sie eigene Prompts und Events erstellen?',
  'kiosk.getYourOwnAccount': 'Jetzt eigenes Konto erstellen',
  'kiosk.longPressToSave': 'Gedrückt halten zum Speichern',
  'kiosk.tapToReturnFullscreen': 'Tippen um zum Vollbild zurückzukehren',
  'kiosk.returnToFullscreen': 'Zum Vollbild zurückkehren',
  'kiosk.fullscreenPrompt': 'Tippen Sie überall, um zum Vollbildmodus zurückzukehren.',
  'kiosk.loading': 'Laden...',

  'kiosk.eventNotStarted': 'EVENT NOCH NICHT GESTARTET',
  'kiosk.eventNotStartedDesc': 'Dieses Event hat noch nicht begonnen',
  'kiosk.eventStarts': 'Event beginnt:',
  'kiosk.eventHasEnded': 'EVENT BEENDET',
  'kiosk.eventConcluded': 'Dieses Event ist beendet',
  'kiosk.eventEnded': 'Event beendet:',
  'kiosk.thankYou': 'Vielen Dank für Ihre Teilnahme!',
  'kiosk.upgradePrompt': 'Bitte upgraden Sie Ihr Abonnement oder kaufen Sie zusätzliche Guthaben, um die Fotokabine weiter zu nutzen.',

  'settings.accountLanguage': 'Kontosprache',
  'settings.accountLanguageDesc': 'Wählen Sie die Sprache für Ihr Dashboard und Ihre Admin-Oberfläche.',
  'settings.saved': 'Einstellungen erfolgreich gespeichert.',
  'settings.saveFailed': 'Einstellungen konnten nicht gespeichert werden. Bitte erneut versuchen.',
  'settings.saving': 'Speichern...',

  'event.languageSettings': 'Spracheinstellungen',
  'event.kioskLanguage': 'Kiosksprache',
  'event.kioskLanguageDesc': 'Wählen Sie die Sprache, die Gäste auf dem Kiosk-Bildschirm für dieses Event sehen.',
  'event.promptTranslations': 'Prompt-Übersetzungen',
  'event.promptTranslationsDesc': 'Übersetzen Sie Ihre Prompt-Namen und Beschreibungen für Gäste. Klicken Sie auf auto-übersetzen, um Übersetzungen zu generieren, und bearbeiten Sie diese dann nach Bedarf.',
  'event.autoTranslateAll': 'Alle auto-übersetzen',
  'event.translating': 'Übersetzen...',
  'event.translate': 'Übersetzen',
  'event.englishSource': 'Englisch (Quelle)',
  'event.save': 'Speichern',
  'event.cancel': 'Abbrechen',
  'event.close': 'Schließen',
  'event.manageLanguage': 'Sprache verwalten',

  'promptLibrary.translations': 'Übersetzungen',
  'promptLibrary.translationsDesc': 'Geben Sie übersetzte Namen und Beschreibungen für diesen Prompt in anderen Sprachen an.',
  'promptLibrary.autoTranslate': 'Auto-Übersetzen',
  'promptLibrary.translating': 'Übersetzen...',
  'promptLibrary.saveTranslations': 'Übersetzungen speichern',
  'promptLibrary.translationsSaved': 'Übersetzungen gespeichert.',
};

const pt: TranslationDict = {
  'kiosk.tapToStart': 'TOQUE PARA COMEÇAR',
  'kiosk.aiPhotoExperience': 'Experiência Foto IA',
  'kiosk.checkingCredits': 'Verificando créditos...',
  'kiosk.photosRemaining': 'fotos restantes neste dispositivo',
  'kiosk.photoRemaining': 'foto restante neste dispositivo',
  'kiosk.exitKiosk': 'Sair do quiosque',

  'kiosk.outOfCredits': 'SEM CRÉDITOS',
  'kiosk.outOfCreditsDesc': 'Este evento esgotou os créditos de geração de imagens',
  'kiosk.upgradeSubscription': 'Melhorar Assinatura',
  'kiosk.purchaseCredits': 'Comprar Créditos',
  'kiosk.needHelp': 'Precisa de ajuda?',
  'kiosk.contactOrganizer': 'Contacte o organizador do evento ou visite o painel da sua conta para gerir créditos e assinatura.',

  'kiosk.photoLimitReached': 'LIMITE DE FOTOS ATINGIDO',
  'kiosk.deviceLimitDesc': 'Este dispositivo já tirou o número permitido de fotos para este evento',
  'kiosk.limit': 'Limite:',
  'kiosk.photoPerDevice': 'foto por dispositivo',
  'kiosk.photosPerDevice': 'fotos por dispositivo',
  'kiosk.askOrganizer': 'Peça ajuda ao organizador do evento se precisar.',

  'kiosk.chooseYourStyle': 'Escolha o Seu Estilo',
  'kiosk.cancel': 'Cancelar',
  'kiosk.back': 'Voltar',

  'kiosk.switchCamera': 'Mudar para câmara traseira',
  'kiosk.switchToFront': 'Mudar para câmara frontal',

  'kiosk.creatingMagic': 'A Criar Magia...',
  'kiosk.applyingStyle': 'A aplicar estilo {style}',
  'kiosk.uploadingImage': 'A enviar imagem...',

  'kiosk.lookGood': 'Está Boa?',
  'kiosk.retake': 'Refazer',
  'kiosk.generateAI': 'Gerar IA',

  'kiosk.getYourPhoto': 'Obtenha a Sua Foto',
  'kiosk.downloadNowOrSent': 'Descarregue agora ou receba por mensagem.',
  'kiosk.downloadNow': 'Descarregar agora (partilha indisponível)',
  'kiosk.getItSent': 'Receba por mensagem abaixo.',
  'kiosk.downloadNowBtn': 'Descarregar Agora',
  'kiosk.downloadPhoto': 'Descarregar Foto',
  'kiosk.orGetItSent': 'ou receba por mensagem',
  'kiosk.sms': 'SMS',
  'kiosk.sendSms': 'Enviar SMS',
  'kiosk.sendViaWhatsApp': 'Enviar por WhatsApp',
  'kiosk.whatsappConsent': 'Ao selecionar Enviar, concorda em receber este link de foto da Fun Frame Photo por WhatsApp.',
  'kiosk.email': 'E-mail',
  'kiosk.sendViaEmail': 'Enviar por E-mail',
  'kiosk.preparingLink': 'A preparar link...',
  'kiosk.sending': 'A enviar...',
  'kiosk.scanForInstantAccess': 'Digitalize para Acesso Instantâneo',
  'kiosk.noPhoneRequired': 'Não é necessário número de telefone',
  'kiosk.viewEventGallery': 'Ver Galeria do Evento',
  'kiosk.skipStartOver': 'Saltar e Recomeçar',
  'kiosk.startOverNow': 'Recomeçar Agora',
  'kiosk.sent': 'Enviado!',
  'kiosk.checkYourPhone': 'Verifique o seu telefone para o link.',
  'kiosk.sendToAnother': 'Enviar para Outro',
  'kiosk.startingOverIn': 'A recomeçar em {seconds} segundos...',
  'kiosk.wantToCreate': 'Quer criar os seus próprios prompts e eventos?',
  'kiosk.getYourOwnAccount': 'Obtenha a Sua Própria Conta Agora',
  'kiosk.longPressToSave': 'Prima sem soltar para guardar',
  'kiosk.tapToReturnFullscreen': 'Toque para Voltar ao Ecrã Inteiro',
  'kiosk.returnToFullscreen': 'Voltar ao Ecrã Inteiro',
  'kiosk.fullscreenPrompt': 'Para a melhor experiência, toque em qualquer lugar para voltar ao ecrã inteiro.',
  'kiosk.loading': 'A carregar...',

  'kiosk.eventNotStarted': 'EVENTO NÃO INICIADO',
  'kiosk.eventNotStartedDesc': 'Este evento ainda não começou',
  'kiosk.eventStarts': 'O evento começa:',
  'kiosk.eventHasEnded': 'O EVENTO TERMINOU',
  'kiosk.eventConcluded': 'Este evento terminou',
  'kiosk.eventEnded': 'O evento terminou:',
  'kiosk.thankYou': 'Obrigado por participar!',
  'kiosk.upgradePrompt': 'Por favor, melhore a sua assinatura ou compre créditos adicionais para continuar a usar a cabine fotográfica.',

  'settings.accountLanguage': 'Idioma da Conta',
  'settings.accountLanguageDesc': 'Escolha o idioma para o seu painel e interface de administração.',
  'settings.saved': 'Definições guardadas com sucesso.',
  'settings.saveFailed': 'Falha ao guardar as definições. Tente novamente.',
  'settings.saving': 'A guardar...',

  'event.languageSettings': 'Definições de Idioma',
  'event.kioskLanguage': 'Idioma do Quiosque',
  'event.kioskLanguageDesc': 'Escolha o idioma que os convidados verão no ecrã do quiosque para este evento.',
  'event.promptTranslations': 'Traduções de Prompts',
  'event.promptTranslationsDesc': 'Traduza os nomes e descrições dos seus prompts para os convidados. Clique em auto-traduzir para gerar traduções, depois edite conforme necessário.',
  'event.autoTranslateAll': 'Auto-Traduzir Tudo',
  'event.translating': 'A traduzir...',
  'event.translate': 'Traduzir',
  'event.englishSource': 'Inglês (Origem)',
  'event.save': 'Guardar',
  'event.cancel': 'Cancelar',
  'event.close': 'Fechar',
  'event.manageLanguage': 'Gerir Idioma',

  'promptLibrary.translations': 'Traduções',
  'promptLibrary.translationsDesc': 'Forneça nomes e descrições traduzidos para este prompt noutros idiomas.',
  'promptLibrary.autoTranslate': 'Auto-Traduzir',
  'promptLibrary.translating': 'A traduzir...',
  'promptLibrary.saveTranslations': 'Guardar Traduções',
  'promptLibrary.translationsSaved': 'Traduções guardadas.',
};

const zh: TranslationDict = {
  'kiosk.tapToStart': '点击开始',
  'kiosk.aiPhotoExperience': 'AI 拍照体验',
  'kiosk.checkingCredits': '正在检查额度...',
  'kiosk.photosRemaining': '张照片剩余于此设备',
  'kiosk.photoRemaining': '张照片剩余于此设备',
  'kiosk.exitKiosk': '退出自助模式',

  'kiosk.outOfCredits': '额度已用完',
  'kiosk.outOfCreditsDesc': '此活动的图像生成额度已用完',
  'kiosk.upgradeSubscription': '升级订阅',
  'kiosk.purchaseCredits': '购买额度',
  'kiosk.needHelp': '需要帮助？',
  'kiosk.contactOrganizer': '请联系活动组织者或访问您的账户仪表板以管理额度和订阅。',

  'kiosk.photoLimitReached': '已达到照片限制',
  'kiosk.deviceLimitDesc': '此设备已拍摄了此活动允许的照片数量',
  'kiosk.limit': '限制：',
  'kiosk.photoPerDevice': '张照片/设备',
  'kiosk.photosPerDevice': '张照片/设备',
  'kiosk.askOrganizer': '如需帮助，请联系活动组织者。',

  'kiosk.chooseYourStyle': '选择您的风格',
  'kiosk.cancel': '取消',
  'kiosk.back': '返回',

  'kiosk.switchCamera': '切换到后置摄像头',
  'kiosk.switchToFront': '切换到前置摄像头',

  'kiosk.creatingMagic': '正在创造魔法...',
  'kiosk.applyingStyle': '正在应用 {style} 风格',
  'kiosk.uploadingImage': '正在上传图片...',

  'kiosk.lookGood': '看起来好吗？',
  'kiosk.retake': '重拍',
  'kiosk.generateAI': '生成 AI',

  'kiosk.getYourPhoto': '获取您的照片',
  'kiosk.downloadNowOrSent': '立即下载或发送给您。',
  'kiosk.downloadNow': '立即下载（分享不可用）',
  'kiosk.getItSent': '在下方发送给您。',
  'kiosk.downloadNowBtn': '立即下载',
  'kiosk.downloadPhoto': '下载照片',
  'kiosk.orGetItSent': '或发送给您',
  'kiosk.sms': '短信',
  'kiosk.sendSms': '发送短信',
  'kiosk.sendViaWhatsApp': '通过 WhatsApp 发送',
  'kiosk.whatsappConsent': '选择发送即表示您同意通过 WhatsApp 接收 Fun Frame Photo 的此照片链接。',
  'kiosk.email': '电子邮件',
  'kiosk.sendViaEmail': '通过电子邮件发送',
  'kiosk.preparingLink': '正在准备链接...',
  'kiosk.sending': '发送中...',
  'kiosk.scanForInstantAccess': '扫码即时获取',
  'kiosk.noPhoneRequired': '无需电话号码',
  'kiosk.viewEventGallery': '查看活动相册',
  'kiosk.skipStartOver': '跳过并重新开始',
  'kiosk.startOverNow': '立即重新开始',
  'kiosk.sent': '已发送！',
  'kiosk.checkYourPhone': '请查看您的手机获取链接。',
  'kiosk.sendToAnother': '发送给另一个人',
  'kiosk.startingOverIn': '{seconds} 秒后重新开始...',
  'kiosk.wantToCreate': '想要创建您自己的提示和活动？',
  'kiosk.getYourOwnAccount': '立即获取您自己的账户',
  'kiosk.longPressToSave': '长按保存',
  'kiosk.tapToReturnFullscreen': '点击返回全屏',
  'kiosk.returnToFullscreen': '返回全屏',
  'kiosk.fullscreenPrompt': '为获得最佳体验，请点击任意位置返回全屏模式。',
  'kiosk.loading': '加载中...',

  'kiosk.eventNotStarted': '活动未开始',
  'kiosk.eventNotStartedDesc': '此活动尚未开始',
  'kiosk.eventStarts': '活动开始时间：',
  'kiosk.eventHasEnded': '活动已结束',
  'kiosk.eventConcluded': '此活动已结束',
  'kiosk.eventEnded': '活动结束时间：',
  'kiosk.thankYou': '感谢您的参与！',
  'kiosk.upgradePrompt': '请升级您的订阅或购买额外额度以继续使用拍照亭。',

  'settings.accountLanguage': '账户语言',
  'settings.accountLanguageDesc': '选择您的仪表板和管理界面的语言。',
  'settings.saved': '设置保存成功。',
  'settings.saveFailed': '保存设置失败，请重试。',
  'settings.saving': '保存中...',

  'event.languageSettings': '语言设置',
  'event.kioskLanguage': '自助机语言',
  'event.kioskLanguageDesc': '选择访客在此活动自助机屏幕上看到的语言。',
  'event.promptTranslations': '提示翻译',
  'event.promptTranslationsDesc': '为访客翻译您的提示名称和描述。点击自动翻译生成翻译，然后根据需要编辑。',
  'event.autoTranslateAll': '全部自动翻译',
  'event.translating': '翻译中...',
  'event.translate': '翻译',
  'event.englishSource': '英语（原文）',
  'event.save': '保存',
  'event.cancel': '取消',
  'event.close': '关闭',
  'event.manageLanguage': '管理语言',

  'promptLibrary.translations': '翻译',
  'promptLibrary.translationsDesc': '为此提示提供其他语言的翻译名称和描述。',
  'promptLibrary.autoTranslate': '自动翻译',
  'promptLibrary.translating': '翻译中...',
  'promptLibrary.saveTranslations': '保存翻译',
  'promptLibrary.translationsSaved': '翻译已保存。',
};

const ja: TranslationDict = {
  'kiosk.tapToStart': 'タップして開始',
  'kiosk.aiPhotoExperience': 'AI写真体験',
  'kiosk.checkingCredits': 'クレジットを確認中...',
  'kiosk.photosRemaining': '枚の写真がこのデバイスに残っています',
  'kiosk.photoRemaining': '枚の写真がこのデバイスに残っています',
  'kiosk.exitKiosk': 'キオスクを終了',

  'kiosk.outOfCredits': 'クレジット切れ',
  'kiosk.outOfCreditsDesc': 'このイベントの画像生成クレジットが尽きました',
  'kiosk.upgradeSubscription': 'サブスクリプションをアップグレード',
  'kiosk.purchaseCredits': 'クレジットを購入',
  'kiosk.needHelp': 'お困りですか？',
  'kiosk.contactOrganizer': 'イベント主催者に連絡するか、アカウントダッシュボードにアクセスしてクレジットとサブスクリプションを管理してください。',

  'kiosk.photoLimitReached': '写真制限に達しました',
  'kiosk.deviceLimitDesc': 'このデバイスはこのイベントの許可された写真数に達しました',
  'kiosk.limit': '制限：',
  'kiosk.photoPerDevice': 'デバイスあたり1枚',
  'kiosk.photosPerDevice': 'デバイスあたり枚',
  'kiosk.askOrganizer': 'サポートが必要な場合はイベント主催者にお尋ねください。',

  'kiosk.chooseYourStyle': 'スタイルを選択',
  'kiosk.cancel': 'キャンセル',
  'kiosk.back': '戻る',

  'kiosk.switchCamera': '背面カメラに切り替え',
  'kiosk.switchToFront': '前面カメラに切り替え',

  'kiosk.creatingMagic': '魔法を作成中...',
  'kiosk.applyingStyle': '{style}スタイルを適用中',
  'kiosk.uploadingImage': '画像をアップロード中...',

  'kiosk.lookGood': 'いい感じですか？',
  'kiosk.retake': '撮り直す',
  'kiosk.generateAI': 'AI生成',

  'kiosk.getYourPhoto': '写真を取得',
  'kiosk.downloadNowOrSent': '今すぐダウンロードまたは送信してもらう。',
  'kiosk.downloadNow': '今すぐダウンロード（共有不可）',
  'kiosk.getItSent': '以下から送信してもらう。',
  'kiosk.downloadNowBtn': '今すぐダウンロード',
  'kiosk.downloadPhoto': '写真をダウンロード',
  'kiosk.orGetItSent': 'または送信してもらう',
  'kiosk.sms': 'SMS',
  'kiosk.sendSms': 'SMSを送信',
  'kiosk.sendViaWhatsApp': 'WhatsAppで送信',
  'kiosk.whatsappConsent': '送信を選択することで、Fun Frame PhotoからWhatsApp経由でこの写真リンクを受信することに同意します。',
  'kiosk.email': 'メール',
  'kiosk.sendViaEmail': 'メールで送信',
  'kiosk.preparingLink': 'リンクを準備中...',
  'kiosk.sending': '送信中...',
  'kiosk.scanForInstantAccess': 'スキャンして即時アクセス',
  'kiosk.noPhoneRequired': '電話番号不要',
  'kiosk.viewEventGallery': 'イベントギャラリーを見る',
  'kiosk.skipStartOver': 'スキップして最初から',
  'kiosk.startOverNow': '今すぐ最初から',
  'kiosk.sent': '送信済み！',
  'kiosk.checkYourPhone': 'リンクの電話を確認してください。',
  'kiosk.sendToAnother': '別の人に送信',
  'kiosk.startingOverIn': '{seconds}秒後に最初から...',
  'kiosk.wantToCreate': '自分のプロンプトとイベントを作成したいですか？',
  'kiosk.getYourOwnAccount': '今すぐ自分のアカウントを取得',
  'kiosk.longPressToSave': '長押しで保存',
  'kiosk.tapToReturnFullscreen': 'タップしてフルスクリーンに戻る',
  'kiosk.returnToFullscreen': 'フルスクリーンに戻る',
  'kiosk.fullscreenPrompt': '最高の体験のために、どこかをタップしてフルスクリーンモードに戻ってください。',
  'kiosk.loading': '読み込み中...',

  'kiosk.eventNotStarted': 'イベント未開始',
  'kiosk.eventNotStartedDesc': 'このイベントはまだ始まっていません',
  'kiosk.eventStarts': 'イベント開始：',
  'kiosk.eventHasEnded': 'イベント終了',
  'kiosk.eventConcluded': 'このイベントは終了しました',
  'kiosk.eventEnded': 'イベント終了：',
  'kiosk.thankYou': 'ご参加ありがとうございました！',
  'kiosk.upgradePrompt': '写真ブースを続けてご利用いただくには、サブスクリプションをアップグレードするか、追加クレジットをご購入ください。',

  'settings.accountLanguage': 'アカウント言語',
  'settings.accountLanguageDesc': 'ダッシュボードと管理画面の言語を選択してください。',
  'settings.saved': '設定が正常に保存されました。',
  'settings.saveFailed': '設定の保存に失敗しました。再試行してください。',
  'settings.saving': '保存中...',

  'event.languageSettings': '言語設定',
  'event.kioskLanguage': 'キオスク言語',
  'event.kioskLanguageDesc': 'このイベントのキオスク画面にゲストが表示する言語を選択してください。',
  'event.promptTranslations': 'プロンプト翻訳',
  'event.promptTranslationsDesc': 'ゲスト向けにプロンプト名と説明を翻訳します。自動翻訳をクリックして翻訳を生成し、必要に応じて編集してください。',
  'event.autoTranslateAll': 'すべて自動翻訳',
  'event.translating': '翻訳中...',
  'event.translate': '翻訳',
  'event.englishSource': '英語（原文）',
  'event.save': '保存',
  'event.cancel': 'キャンセル',
  'event.close': '閉じる',
  'event.manageLanguage': '言語を管理',

  'promptLibrary.translations': '翻訳',
  'promptLibrary.translationsDesc': 'このプロンプトの他の言語の翻訳名と説明を入力してください。',
  'promptLibrary.autoTranslate': '自動翻訳',
  'promptLibrary.translating': '翻訳中...',
  'promptLibrary.saveTranslations': '翻訳を保存',
  'promptLibrary.translationsSaved': '翻訳が保存されました。',
};

const ko: TranslationDict = {
  'kiosk.tapToStart': '탭하여 시작',
  'kiosk.aiPhotoExperience': 'AI 사진 체험',
  'kiosk.checkingCredits': '크레딧 확인 중...',
  'kiosk.photosRemaining': '이 기기에 남은 사진',
  'kiosk.photoRemaining': '이 기기에 남은 사진',
  'kiosk.exitKiosk': '키오스크 종료',

  'kiosk.outOfCredits': '크레딧 부족',
  'kiosk.outOfCreditsDesc': '이 이벤트의 이미지 생성 크레딧이 모두 소진되었습니다',
  'kiosk.upgradeSubscription': '구독 업그레이드',
  'kiosk.purchaseCredits': '크레딧 구매',
  'kiosk.needHelp': '도움이 필요하신가요?',
  'kiosk.contactOrganizer': '이벤트 주최자에게 연락하거나 계정 대시보드에서 크레딧과 구독을 관리하세요.',

  'kiosk.photoLimitReached': '사진 한도 도달',
  'kiosk.deviceLimitDesc': '이 기기는 이 이벤트에서 허용된 사진 수에 도달했습니다',
  'kiosk.limit': '한도:',
  'kiosk.photoPerDevice': '기기당 사진 1장',
  'kiosk.photosPerDevice': '기기당 사진',
  'kiosk.askOrganizer': '도움이 필요하시면 이벤트 주최자에게 문의하세요.',

  'kiosk.chooseYourStyle': '스타일 선택',
  'kiosk.cancel': '취소',
  'kiosk.back': '뒤로',

  'kiosk.switchCamera': '후면 카메라로 전환',
  'kiosk.switchToFront': '전면 카메라로 전환',

  'kiosk.creatingMagic': '마법을 만드는 중...',
  'kiosk.applyingStyle': '{style} 스타일 적용 중',
  'kiosk.uploadingImage': '이미지 업로드 중...',

  'kiosk.lookGood': '괜찮아 보이나요?',
  'kiosk.retake': '다시 촬영',
  'kiosk.generateAI': 'AI 생성',

  'kiosk.getYourPhoto': '사진 받기',
  'kiosk.downloadNowOrSent': '지금 다운로드하거나 전송받으세요.',
  'kiosk.downloadNow': '지금 다운로드 (공유 불가)',
  'kiosk.getItSent': '아래에서 전송받으세요.',
  'kiosk.downloadNowBtn': '지금 다운로드',
  'kiosk.downloadPhoto': '사진 다운로드',
  'kiosk.orGetItSent': '또는 전송받으세요',
  'kiosk.sms': 'SMS',
  'kiosk.sendSms': 'SMS 전송',
  'kiosk.sendViaWhatsApp': 'WhatsApp으로 전송',
  'kiosk.whatsappConsent': '전송을 선택하면 Fun Frame Photo에서 WhatsApp을 통해 이 사진 링크를 수신하는 데 동의하는 것입니다.',
  'kiosk.email': '이메일',
  'kiosk.sendViaEmail': '이메일로 전송',
  'kiosk.preparingLink': '링크 준비 중...',
  'kiosk.sending': '전송 중...',
  'kiosk.scanForInstantAccess': '스캔하여 즉시 접속',
  'kiosk.noPhoneRequired': '전화번호 불필요',
  'kiosk.viewEventGallery': '이벤트 갤러리 보기',
  'kiosk.skipStartOver': '건너뛰고 다시 시작',
  'kiosk.startOverNow': '지금 다시 시작',
  'kiosk.sent': '전송됨!',
  'kiosk.checkYourPhone': '링크를 확인하려면 전화기를 확인하세요.',
  'kiosk.sendToAnother': '다른 사람에게 전송',
  'kiosk.startingOverIn': '{seconds}초 후 다시 시작...',
  'kiosk.wantToCreate': '직접 프롬프트와 이벤트를 만들고 싶으신가요?',
  'kiosk.getYourOwnAccount': '지금 나만의 계정 만들기',
  'kiosk.longPressToSave': '길게 눌러 저장',
  'kiosk.tapToReturnFullscreen': '탭하여 전체 화면으로 돌아가기',
  'kiosk.returnToFullscreen': '전체 화면으로 돌아가기',
  'kiosk.fullscreenPrompt': '최상의 경험을 위해 아무 곳이나 탭하여 전체 화면 모드로 돌아가세요.',
  'kiosk.loading': '로딩 중...',

  'kiosk.eventNotStarted': '이벤트 미시작',
  'kiosk.eventNotStartedDesc': '이 이벤트는 아직 시작되지 않았습니다',
  'kiosk.eventStarts': '이벤트 시작:',
  'kiosk.eventHasEnded': '이벤트 종료',
  'kiosk.eventConcluded': '이 이벤트는 종료되었습니다',
  'kiosk.eventEnded': '이벤트 종료:',
  'kiosk.thankYou': '참여해 주셔서 감사합니다!',
  'kiosk.upgradePrompt': '포토 부스를 계속 이용하려면 구독을 업그레이드하거나 추가 크레딧을 구매하세요.',

  'settings.accountLanguage': '계정 언어',
  'settings.accountLanguageDesc': '대시보드 및 관리 인터페이스의 언어를 선택하세요.',
  'settings.saved': '설정이 성공적으로 저장되었습니다.',
  'settings.saveFailed': '설정 저장에 실패했습니다. 다시 시도해 주세요.',
  'settings.saving': '저장 중...',

  'event.languageSettings': '언어 설정',
  'event.kioskLanguage': '키오스크 언어',
  'event.kioskLanguageDesc': '이 이벤트의 키오스크 화면에서 게스트가 볼 언어를 선택하세요.',
  'event.promptTranslations': '프롬프트 번역',
  'event.promptTranslationsDesc': '게스트를 위해 프롬프트 이름과 설명을 번역하세요. 자동 번역을 클릭하여 번역을 생성한 후 필요에 따라 편집하세요.',
  'event.autoTranslateAll': '모두 자동 번역',
  'event.translating': '번역 중...',
  'event.translate': '번역',
  'event.englishSource': '영어 (원문)',
  'event.save': '저장',
  'event.cancel': '취소',
  'event.close': '닫기',
  'event.manageLanguage': '언어 관리',

  'promptLibrary.translations': '번역',
  'promptLibrary.translationsDesc': '이 프롬프트의 다른 언어 번역 이름과 설명을 입력하세요.',
  'promptLibrary.autoTranslate': '자동 번역',
  'promptLibrary.translating': '번역 중...',
  'promptLibrary.saveTranslations': '번역 저장',
  'promptLibrary.translationsSaved': '번역이 저장되었습니다.',
};

const TRANSLATIONS: Record<LanguageCode, TranslationDict> = {
  'en-US': enUS,
  es,
  fr,
  de,
  pt,
  zh,
  ja,
  ko,
};

interface I18nContextValue {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  language: 'en-US',
  setLanguage: () => {},
  t: (key) => key,
});

export const I18nProvider: React.FC<{ language?: LanguageCode; children: React.ReactNode }> = ({ language = 'en-US', children }) => {
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>(language);

  useEffect(() => {
    setCurrentLanguage(language);
  }, [language]);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const dict = TRANSLATIONS[currentLanguage] || TRANSLATIONS['en-US'];
    let value = dict[key] || TRANSLATIONS['en-US'][key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return value;
  }, [currentLanguage]);

  return (
    <I18nContext.Provider value={{ language: currentLanguage, setLanguage: setCurrentLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextValue => {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return { language: 'en-US', setLanguage: () => {}, t: (key: string) => key };
  }
  return ctx;
};

export const translateText = (key: string, language: LanguageCode, params?: Record<string, string | number>): string => {
  const dict = TRANSLATIONS[language] || TRANSLATIONS['en-US'];
  let value = dict[key] || TRANSLATIONS['en-US'][key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return value;
};
