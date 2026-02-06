import * as React from 'react';
import {useEffect, useState} from 'react';
import {Pressable} from 'react-native';
import {ActorRefFrom} from 'xstate';
import {ErrorMessageOverlay} from '../../MessageOverlay';
import {Theme} from '../../ui/styleUtils';
import {VCMetadata} from '../../../shared/VCMetadata';
import {format} from 'date-fns';

import {VCCardSkeleton} from '../common/VCCardSkeleton';
import {VCCardViewContent} from './VCCardViewContent';
import {useVcItemController} from '../VCItemController';
import {getCredentialIssuersWellKnownConfig} from '../../../shared/openId4VCI/Utils';
import {CARD_VIEW_DEFAULT_FIELDS, isVCLoaded} from '../common/VCUtils';
import {VCItemMachine} from '../../../machines/VerifiableCredential/VCItemMachine/VCItemMachine';
import {useTranslation} from 'react-i18next';
import {Copilot} from '../../ui/Copilot';
import {VCProcessor} from '../common/VCProcessor';

export const VCCardView: React.FC<VCItemProps> = ({
  vcMetadata,
  selectable,
  selected,
  onPress,
  isDownloading,
  isPinned,
  flow,
  isInitialLaunch = false,
  isTopCard = false,
  onDisclosuresChange,
  requestedClaims,
}) => {
  const controller = useVcItemController(vcMetadata);
  const {t} = useTranslation();

  const service = controller.VCItemService;
  const verifiableCredentialData = controller.verifiableCredentialData;
  const generatedOn = -controller.generatedOn;

  let formattedDate =
    generatedOn && format(new Date(generatedOn), 'MM/dd/yyyy');

  useEffect(() => {
    controller.UPDATE_VC_METADATA(vcMetadata);
  }, [vcMetadata]);

  const [fields, setFields] = useState([]);
  const [wellknown, setWellknown] = useState(null);
  const [vc, setVc] = useState(null);

  useEffect(() => {
    async function loadVc() {
      console.log(`\n🔍 [VCCardView] VC loading check (useEffect triggered):`);
      console.log(`   - isDownloading: ${isDownloading}`);
      console.log(`   - Has controller.credential: ${!!controller.credential}`);

      if (!isDownloading) {
        console.log(`   ✓ Not downloading, checking credential...`);
        if (!controller.credential) {
          console.warn(`   ⚠️  No credential in controller - cannot process`);
          return;
        }

        console.log(`   ✓ Has credential, entering try block...`);
        try {
          console.log(
            `\n🎴🎴🎴 [VCCardView] INSIDE TRY BLOCK - Processing VC for rendering`,
          );
          console.log(`   - VC Key: ${vcMetadata?.getVcKey()}`);
          console.log(
            `   - Format: ${controller.verifiableCredentialData.format}`,
          );
          console.log(
            `   - Credential Type: ${vcMetadata?.credentialType || 'unknown'}`,
          );
          console.log(`   - Issuer: ${vcMetadata?.issuer}`);
          console.log(`   - Credential type: ${typeof controller.credential}`);
          console.log(`   🔄 Starting VCProcessor.processForRendering...`);

          const processedData = await VCProcessor.processForRendering(
            controller.credential,
            controller.verifiableCredentialData.format,
          );

          console.log(`   ✅ VC processed successfully`);
          console.log(
            `   - Processed data keys: ${Object.keys(processedData || {}).join(
              ', ',
            )}`,
          );
          if (processedData?.fullResolvedPayload?.vct) {
            console.log(
              `   - SD-JWT vct: ${processedData.fullResolvedPayload.vct}`,
            );
          }
          console.log(`   💾 Setting vc state...`);
          setVc(processedData);
          console.log(`   ✅ VC state set successfully`);
        } catch (error) {
          console.error(`   ❌ Failed to process VC:`, error);
          console.error(`   Error message:`, error?.message);
          console.error(`   Error stack:`, error?.stack);
        }
      } else {
        console.log(`   ⏸️  Skipping - isDownloading is true`);
      }
    }
    loadVc();
  }, [isDownloading, controller.credential]);

  useEffect(() => {
    if (!verifiableCredentialData || !verifiableCredentialData.vcMetadata)
      return;
    const {
      credentialConfigurationId,
      vcMetadata: {format},
    } = verifiableCredentialData;

    // Check if well-known config is already stored with the VC
    if (
      controller.wellknownResponse &&
      Object.keys(controller.wellknownResponse).length > 0
    ) {
      console.log(
        `\n📦 [VCCardView] Using stored well-known config (no fetch needed)`,
      );
      console.log(`   - VC Key: ${vcMetadata?.getVcKey()}`);
      setWellknown(controller.wellknownResponse);
      setFields(CARD_VIEW_DEFAULT_FIELDS);
      return;
    }

    if (vcMetadata.issuerHost) {
      console.log(`\n🌐 [VCCardView] Fetching well-known config:`);
      console.log(`   - Issuer Host: ${vcMetadata.issuerHost}`);
      console.log(`   - Credential Config ID: ${credentialConfigurationId}`);
      console.log(`   - Format: ${format}`);

      getCredentialIssuersWellKnownConfig(
        vcMetadata.issuerHost,
        CARD_VIEW_DEFAULT_FIELDS,
        credentialConfigurationId,
        format,
        vcMetadata.issuerHost,
      )
        .then(response => {
          if (response && response.matchingCredentialIssuerMetadata) {
            console.log(`   ✅ Well-known config fetched successfully`);
            setWellknown(response.matchingCredentialIssuerMetadata);
          } else {
            console.warn(
              `   ⚠️  No matching credential metadata in well-known, using fallback`,
            );
            setWellknown({fallback: 'true'});
          }
          setFields(response.fields);
        })
        .catch(error => {
          console.error(
            `   ❌ Failed to fetch well-known config:`,
            error.message,
          );
          console.log(`   ⚠️  Using fallback mode (will use vct if available)`);
          setWellknown({fallback: 'true'});
        });
    }
  }, [verifiableCredentialData]);

  const canRender = isVCLoaded(controller.credential) && wellknown && vc;

  if (!canRender) {
    console.log(`\n⏳ [VCCardView] Showing skeleton - Waiting for:`);
    console.log(`   - VC Loaded: ${isVCLoaded(controller.credential)}`);
    console.log(`   - Well-known: ${!!wellknown}`);
    console.log(`   - Processed VC: ${!!vc}`);
    return <VCCardSkeleton />;
  }

  console.log(
    `✅ [VCCardView] Rendering VC card for ${vcMetadata?.getVcKey()}`,
  );

  const CardViewContent = () => (
    <VCCardViewContent
      vcMetadata={vcMetadata}
      walletBindingResponse={controller.walletBindingResponse}
      credential={vc}
      verifiableCredentialData={verifiableCredentialData}
      wellknown={wellknown}
      selectable={selectable}
      selected={selected}
      service={service}
      isPinned={isPinned}
      onPress={() => onPress(service)}
      flow={flow}
      isKebabPopUp={controller.isKebabPopUp}
      DISMISS={controller.DISMISS}
      KEBAB_POPUP={controller.KEBAB_POPUP}
      isInitialLaunch={isInitialLaunch}
      onDisclosuresChange={onDisclosuresChange}
      requestedClaims={requestedClaims}
    />
  );

  const wrapTopCard = () => (
    <Copilot
      description={t('copilot:cardMessage')}
      order={6}
      title={t('copilot:cardTitle')}
      children={CardViewContent()}
    />
  );

  return (
    <React.Fragment>
      <Pressable
        accessible={false}
        onPress={() => onPress(service)}
        style={
          selected
            ? Theme.Styles.selectedBindedVc
            : Theme.Styles.closeCardBgContainer
        }>
        {(isInitialLaunch || controller.isTourGuide) && isTopCard
          ? wrapTopCard()
          : CardViewContent()}
      </Pressable>
      <ErrorMessageOverlay
        isVisible={controller.isSavingFailedInIdle}
        error={controller.storeErrorTranslationPath}
        onDismiss={controller.DISMISS}
        translationPath={'VcDetails'}
      />
    </React.Fragment>
  );
};

export interface VCItemProps {
  vcMetadata: VCMetadata;
  margin?: string;
  selectable?: boolean;
  selected?: boolean;
  onPress: (vcRef?: ActorRefFrom<typeof VCItemMachine>) => void;
  onShow?: (vcRef?: ActorRefFrom<typeof VCItemMachine>) => void;
  isDownloading?: boolean;
  isPinned?: boolean;
  flow?: string;
  isInitialLaunch?: boolean;
  isTopCard?: boolean;
  onDisclosuresChange?: (paths: string[]) => void;
  requestedClaims?: string; // Comma-separated list of claims requested by verifier
}
