import {assign} from 'xstate';
import {send, sendParent} from 'xstate/lib/actions';
import {
  OVP_ERROR_CODE,
  OVP_ERROR_MESSAGES,
  SHOW_FACE_AUTH_CONSENT_SHARE_FLOW,
} from '../../shared/constants';
import {VC} from '../VerifiableCredential/VCMetaMachine/vc';
import {StoreEvents} from '../store';
import {JSONPath} from 'jsonpath-plus';

import {VCShareFlowType} from '../../shared/Utils';
import {ActivityLogEvents} from '../activityLog';
import {VPShareActivityLog} from '../../components/VPShareActivityLogEvent';
import OpenID4VP from '../../shared/openID4VP/OpenID4VP';
import {VCFormat} from '../../shared/VCFormat';
import {
  getIssuerAuthenticationAlorithmForMdocVC,
  getMdocAuthenticationAlorithm,
} from '../../components/VC/common/VCUtils';

// TODO - get this presentation definition list which are alias for scope param
// from the verifier end point after the endpoint is created and exposed.

export const openID4VPActions = (model: any) => {
  let result;
  return {
    setAuthenticationResponse: model.assign({
      authenticationResponse: (_, event) => event.data,
    }),

    setUrlEncodedAuthorizationRequest: model.assign({
      urlEncodedAuthorizationRequest: (_, event) => event.encodedAuthRequest,
    }),

    setFlowType: model.assign({
      flowType: (_, event) => event.flowType,
    }),

    getVcsMatchingAuthRequest: model.assign({
      vcsMatchingAuthRequest: (context, event) => {
        result = getVcsMatchingAuthRequest(context, event);
        return result.matchingVCs;
      },
      requestedClaims: () => result.requestedClaims,

      purpose: context => {
        const response = context.authenticationResponse;
        const pd = response['presentation_definition'];
        return pd.purpose ?? '';
      },
    }),

    setSelectedVCs: model.assign({
      selectedVCs: (_, event) => event.selectedVCs,
      selectedDisclosuresByVc: (_, event) => event.selectedDisclosuresByVc,
    }),

    compareAndStoreSelectedVC: model.assign({
      selectedVCs: context => {
        const matchingVcs = {};
        Object.entries(context.vcsMatchingAuthRequest).map(
          ([inputDescriptorId, vcs]) =>
            (vcs as VC[]).map(vcData => {
              if (
                vcData.vcMetadata.requestId ===
                context.miniViewSelectedVC.vcMetadata.requestId
              ) {
                matchingVcs[inputDescriptorId] = [vcData];
              }
            }),
        );
        return matchingVcs;
      },
    }),

    setMiniViewShareSelectedVC: model.assign({
      miniViewSelectedVC: (_, event) => event.selectedVC,
    }),

    setIsShareWithSelfie: model.assign({
      isShareWithSelfie: (_, event) =>
        event.flowType ===
        VCShareFlowType.MINI_VIEW_SHARE_WITH_SELFIE_OPENID4VP,
    }),

    setIsOVPViaDeepLink: model.assign({
      isOVPViaDeepLink: (_, event) => event.isOVPViaDeepLink,
    }),

    resetIsOVPViaDeepLink: model.assign({
      isOVPViaDeepLink: () => false,
    }),

    setShowFaceAuthConsent: model.assign({
      showFaceAuthConsent: (_, event) => {
        return !event.isDoNotAskAgainChecked;
      },
    }),

    storeShowFaceAuthConsent: send(
      (_, event) =>
        StoreEvents.SET(
          SHOW_FACE_AUTH_CONSENT_SHARE_FLOW,
          !event.isDoNotAskAgainChecked,
        ),
      {
        to: context => context.serviceRefs.store,
      },
    ),

    getFaceAuthConsent: send(
      StoreEvents.GET(SHOW_FACE_AUTH_CONSENT_SHARE_FLOW),
      {
        to: (context: any) => context.serviceRefs.store,
      },
    ),

    updateShowFaceAuthConsent: model.assign({
      showFaceAuthConsent: (_, event) => {
        return event.response || event.response === null;
      },
    }),

    forwardToParent: sendParent('DISMISS'),

    setError: model.assign({
      error: (_, event) => {
        console.error('Error:', event.data.message);
        return event.data.message;
      },
    }),

    resetError: model.assign({
      error: () => '',
    }),

    resetIsShareWithSelfie: model.assign({isShareWithSelfie: () => false}),

    loadKeyPair: assign({
      publicKey: (_, event: any) => event.data?.publicKey as string,
      privateKey: (context: any, event: any) =>
        event.data?.privateKey
          ? event.data.privateKey
          : (context.privateKey as string),
    }),

    incrementOpenID4VPRetryCount: model.assign({
      openID4VPRetryCount: context => context.openID4VPRetryCount + 1,
    }),

    resetOpenID4VPRetryCount: model.assign({
      openID4VPRetryCount: () => 0,
    }),

    setAuthenticationError: model.assign({
      error: (_, event) => {
        console.error('Error:', event.data.message, event.data.code);
        return event.data.code;
      },
    }),

    setTrustedVerifiersApiCallError: model.assign({
      error: (_, event) => {
        console.error('Error:', event.data.message);
        return 'api error - ' + event.data.message;
      },
    }),

    showTrustConsentModal: assign({
      showTrustConsentModal: () => true,
    }),

    dismissTrustModal: assign({
      showTrustConsentModal: () => false,
    }),

    setSendVPShareError: model.assign({
      error: (_, event) => {
        console.error('Error:', event.data.message, event.data.code);
        return 'send vp-' + event.data.message + '-' + event.data.code;
      },
    }),

    setTrustedVerifiers: model.assign({
      trustedVerifiers: (_: any, event: any) => event.data.response.verifiers,
    }),

    updateFaceCaptureBannerStatus: model.assign({
      showFaceCaptureSuccessBanner: () => true,
    }),

    resetFaceCaptureBannerStatus: model.assign({
      showFaceCaptureSuccessBanner: false,
    }),

    logActivity: send(
      (context: any, event: any) => {
        let logType = event.logType;

        if (logType === 'RETRY_ATTEMPT_FAILED') {
          logType =
            context.openID4VPRetryCount === 0
              ? 'SHARING_FAILED'
              : context.openID4VPRetryCount === 3
              ? 'MAX_RETRY_ATTEMPT_FAILED'
              : logType;
        }

        if (context.openID4VPRetryCount > 1) {
          switch (logType) {
            case 'SHARED_SUCCESSFULLY':
              logType = 'SHARED_AFTER_RETRY';
              break;
            case 'SHARED_WITH_FACE_VERIFIACTION':
              logType = 'SHARED_WITH_FACE_VERIFICATION_AFTER_RETRY';
          }
        }
        return ActivityLogEvents.LOG_ACTIVITY(
          VPShareActivityLog.getLogFromObject({
            type: logType,
            timestamp: Date.now(),
          }),
        );
      },
      {to: (context: any) => context.serviceRefs.activityLog},
    ),

    shareDeclineStatus: () => {
      OpenID4VP.sendErrorToVerifier(
        OVP_ERROR_MESSAGES.DECLINED,
        OVP_ERROR_CODE.DECLINED,
      );
    },

    setIsFaceVerificationRetryAttempt: model.assign({
      isFaceVerificationRetryAttempt: () => true,
    }),

    resetIsFaceVerificationRetryAttempt: model.assign({
      isFaceVerificationRetryAttempt: () => false,
    }),

    setIsShowLoadingScreen: model.assign({
      showLoadingScreen: () => true,
    }),

    resetIsShowLoadingScreen: model.assign({
      showLoadingScreen: () => false,
    }),
  };
};

function getVcsMatchingAuthRequest(context, event) {
  const vcs = event.vcs;
  const matchingVCs: Record<string, any[]> = {};
  const requestedClaimsByVerifier = new Set<string>();
  const presentationDefinition =
    context.authenticationResponse['presentation_definition'];
  const inputDescriptors = presentationDefinition['input_descriptors'];
  let hasFormatOrConstraints = false;

  console.log('🔍 [VP MATCHING] Starting credential matching process');
  console.log('🔍 [VP MATCHING] Number of VCs to check:', vcs.length);
  console.log(
    '🔍 [VP MATCHING] Number of input descriptors:',
    inputDescriptors.length,
  );
  console.log(
    '🔍 [VP MATCHING] Presentation definition:',
    JSON.stringify(presentationDefinition, null, 2),
  );

  vcs.forEach(vc => {
    console.log('\n🔍 [VP MATCHING] ===== Checking VC =====');
    console.log('🔍 [VP MATCHING] VC format:', vc.format);
    console.log('🔍 [VP MATCHING] VC ID:', vc.id);
    console.log(
      '🔍 [VP MATCHING] VC credential type/vct:',
      vc.verifiableCredential?.credential?.vct ||
        vc.verifiableCredential?.credential?.type,
    );

    inputDescriptors.forEach(inputDescriptor => {
      console.log(
        '🔍 [VP MATCHING] --- Checking input descriptor:',
        inputDescriptor.id,
      );
      const format = inputDescriptor.format ?? presentationDefinition.format;
      console.log('🔍 [VP MATCHING] Required format:', JSON.stringify(format));
      hasFormatOrConstraints =
        hasFormatOrConstraints ||
        format !== undefined ||
        inputDescriptor.constraints.fields !== undefined;

      const areMatchingFormatAndProofType =
        areVCFormatAndProofTypeMatchingRequest(format, vc);
      console.log(
        '🔍 [VP MATCHING] Format/proof match result:',
        areMatchingFormatAndProofType,
      );
      if (areMatchingFormatAndProofType == false) {
        inputDescriptors.forEach(inputDescriptor => {
          if (inputDescriptor.constraints?.fields) {
            inputDescriptor.constraints.fields.forEach(field => {
              if (field.path) {
                field.path.forEach(path => {
                  try {
                    const pathArray = JSONPath.toPathArray(path);
                    const claimName = pathArray[pathArray.length - 1];
                    requestedClaimsByVerifier.add(claimName);
                  } catch (error) {
                    console.error('Error parsing path:', path, error);
                  }
                });
              }
            });
          }
        });
        return;
      }
      const isMatchingConstraints = isVCMatchingRequestConstraints(
        inputDescriptor.constraints,
        vc,
        requestedClaimsByVerifier,
      );
      console.log(
        '🔍 [VP MATCHING] Constraint match result:',
        isMatchingConstraints,
      );

      let shouldInclude: boolean;
      if (inputDescriptor.constraints.fields && format) {
        shouldInclude = isMatchingConstraints && areMatchingFormatAndProofType;
        console.log(
          '🔍 [VP MATCHING] Decision logic: fields AND format both required',
        );
      } else {
        shouldInclude = isMatchingConstraints || areMatchingFormatAndProofType;
        console.log(
          '🔍 [VP MATCHING] Decision logic: fields OR format (either works)',
        );
      }
      console.log(
        '🔍 [VP MATCHING] Final decision - shouldInclude:',
        shouldInclude,
      );

      if (shouldInclude) {
        if (!matchingVCs[inputDescriptor.id]) {
          matchingVCs[inputDescriptor.id] = [];
          console.log(
            `🪣 [BUCKET] Created new bucket for descriptor: "${inputDescriptor.id}"`,
          );
        }
        try {
          const vcKey = vc.vcMetadata?.getVcKey
            ? vc.vcMetadata.getVcKey()
            : JSON.stringify(vc.vcMetadata);
          const vcIdentifier =
            vc.verifiableCredential?.credential?.vct ||
            vc.verifiableCredential?.credential?.type ||
            vc.verifiableCredential?.credentialConfigurationId ||
            vcKey;
          console.log(
            `🪣 [BUCKET] ✅ Adding VC to bucket "${inputDescriptor.id}"`,
          );
          console.log(`🪣 [BUCKET]    VC identifier : ${vcIdentifier}`);
          console.log(`🪣 [BUCKET]    VC format     : ${vc.format}`);
          console.log(`🪣 [BUCKET]    VC key        : ${vcKey}`);
          console.log(
            `🪣 [BUCKET]    Bucket size after add: ${
              matchingVCs[inputDescriptor.id].length + 1
            }`,
          );
        } catch (e) {
          console.log(`🪣 [BUCKET] ⚠️  Error logging VC details:`, e.message);
        }
        matchingVCs[inputDescriptor.id].push(vc);
      } else {
        try {
          const vcKey = vc.vcMetadata?.getVcKey
            ? vc.vcMetadata.getVcKey()
            : JSON.stringify(vc.vcMetadata);
          console.log(
            `🪣 [BUCKET] ❌ VC did NOT match descriptor "${inputDescriptor.id}" — skipping`,
          );
          console.log(`🪣 [BUCKET]    VC key: ${vcKey}`);
        } catch (e) {
          // ignore logging error
        }
      }
    });
  });

  // ── Bucket summary ──────────────────────────────────────────────────────────
  console.log('\n🪣 [BUCKET SUMMARY] ==============================');
  console.log(
    `🪣 [BUCKET SUMMARY] Total descriptors in PD : ${inputDescriptors.length}`,
  );
  console.log(
    `🪣 [BUCKET SUMMARY] Descriptors with matches: ${
      Object.keys(matchingVCs).length
    }`,
  );
  inputDescriptors.forEach(descriptor => {
    const bucket = matchingVCs[descriptor.id];
    const count = bucket ? bucket.length : 0;
    const status = count > 0 ? '✅' : '❌ UNSATISFIED';
    console.log(
      `🪣 [BUCKET SUMMARY]   "${descriptor.id}" → ${count} VC(s) ${status}`,
    );
    if (bucket && bucket.length > 0) {
      bucket.forEach((matchedVc, idx) => {
        try {
          const vcKey = matchedVc.vcMetadata?.getVcKey
            ? matchedVc.vcMetadata.getVcKey()
            : JSON.stringify(matchedVc.vcMetadata);
          const vcIdentifier =
            matchedVc.verifiableCredential?.credential?.vct ||
            matchedVc.verifiableCredential?.credential?.type ||
            matchedVc.verifiableCredential?.credentialConfigurationId ||
            vcKey;
          console.log(
            `🪣 [BUCKET SUMMARY]     [${idx}] ${vcIdentifier} (${matchedVc.format})`,
          );
        } catch (e) {
          console.log(`🪣 [BUCKET SUMMARY]     [${idx}] <error reading vc>`);
        }
      });
    }
  });
  console.log('🪣 [BUCKET SUMMARY] ==============================\n');
  // ────────────────────────────────────────────────────────────────────────────

  if (!hasFormatOrConstraints && inputDescriptors.length > 0) {
    console.log(
      '🪣 [BUCKET] ⚠️  No format or constraints found anywhere in PD — assigning ALL VCs to first descriptor:',
      inputDescriptors[0].id,
    );
    matchingVCs[inputDescriptors[0].id] = vcs;
  }

  if (Object.keys(matchingVCs).length === 0) {
    console.log(
      '🪣 [BUCKET] 🚨 No VCs matched any descriptor — sending error to verifier',
    );
    OpenID4VP.sendErrorToVerifier(
      OVP_ERROR_MESSAGES.NO_MATCHING_VCS,
      OVP_ERROR_CODE.NO_MATCHING_VCS,
    );
  }

  return {
    matchingVCs,
    requestedClaims: Array.from(requestedClaimsByVerifier).join(','),
    purpose: presentationDefinition.purpose ?? '',
  };
}

function areVCFormatAndProofTypeMatchingRequest(
  requestFormat: Record<string, any> | undefined,
  vc: any,
): boolean {
  if (!requestFormat) {
    return false;
  }
  const vcFormatType = vc.format;
  if (vcFormatType === VCFormat.ldp_vc) {
    const vcProofType = vc?.verifiableCredential?.credential?.proof?.type;
    return Object.entries(requestFormat).some(
      ([type, value]) =>
        type === vcFormatType && value.proof_type.includes(vcProofType),
    );
  }

  if (vcFormatType === VCFormat.mso_mdoc) {
    try {
      const issuerAuth =
        vc.verifiableCredential.processedCredential.issuerSigned?.issuerAuth ??
        vc.verifiableCredential.processedCredential.issuerAuth;
      const issuerAuthenticationAlgorithm =
        getIssuerAuthenticationAlorithmForMdocVC(issuerAuth[0]['1']);
      const mdocAuthenticationAlgorithm = getMdocAuthenticationAlorithm(
        issuerAuth[2],
      );

      return Object.entries(requestFormat).some(
        ([type, value]) =>
          type === vcFormatType &&
          value.alg.includes(issuerAuthenticationAlgorithm) &&
          value.alg.includes(mdocAuthenticationAlgorithm),
      );
    } catch (error) {
      console.error('Error in processing mdoc VC format:', error);
      return false;
    }
  }

  if (
    vcFormatType === VCFormat.dc_sd_jwt ||
    vcFormatType === VCFormat.vc_sd_jwt
  ) {
    try {
      const sdJwt = vc.verifiableCredential?.credential;
      const alg = extractAlgFromSdJwt(sdJwt);
      console.log('🔍 [FORMAT MATCH] SD-JWT algorithm from VC:', alg);
      console.log(
        '🔍 [FORMAT MATCH] Required algorithms:',
        JSON.stringify(requestFormat),
      );

      const matchResult = Object.entries(requestFormat).some(
        ([type, value]) => {
          const typeMatch = type === vcFormatType;
          const algMatch = value['sd-jwt_alg_values']?.includes(alg);
          console.log(
            '🔍 [FORMAT MATCH] Type match:',
            typeMatch,
            '(',
            type,
            '==',
            vcFormatType,
            ')',
          );
          console.log(
            '🔍 [FORMAT MATCH] Alg match:',
            algMatch,
            '(',
            alg,
            'in',
            value['sd-jwt_alg_values'],
            ')',
          );
          return typeMatch && algMatch;
        },
      );
      console.log('🔍 [FORMAT MATCH] SD-JWT final match result:', matchResult);
      return matchResult;
    } catch (e) {
      console.error('Error processing SD-JWT alg match:', e);
      return false;
    }
  }

  return false;
}

function isVCMatchingRequestConstraints(
  constraints: any,
  credential: any,
  requestedClaimsByVerifier: Set<string>,
): boolean {
  if (!constraints.fields) {
    console.log('🔍 [CONSTRAINT MATCH] No constraint fields to check');
    return false;
  }
  console.log(
    '🔍 [CONSTRAINT MATCH] Checking',
    constraints.fields.length,
    'constraint fields',
  );

  return constraints.fields.every(field => {
    console.log('🔍 [CONSTRAINT MATCH] Field paths to check:', field.path);
    console.log(
      '🔍 [CONSTRAINT MATCH] Field filter:',
      JSON.stringify(field.filter),
    );
    console.log('🔍 [CONSTRAINT MATCH] Field optional:', field.optional);

    return field.path.some(path => {
      const pathArray = JSONPath.toPathArray(path);
      const claimName = pathArray[pathArray.length - 1];
      requestedClaimsByVerifier.add(claimName);
      const processedCredential = fetchCredentialBasedOnFormat(credential);
      console.log('🔍 [CONSTRAINT MATCH] Searching for path:', path);
      console.log(
        '🔍 [CONSTRAINT MATCH] In credential:',
        JSON.stringify(processedCredential, null, 2),
      );

      const jsonPathMatches = JSONPath({
        path: path,
        json: processedCredential,
      });
      console.log(
        '🔍 [CONSTRAINT MATCH] JSONPath matches found:',
        jsonPathMatches?.length || 0,
        '- Values:',
        JSON.stringify(jsonPathMatches),
      );
      if (!jsonPathMatches || jsonPathMatches.length === 0) {
        return false;
      }
      return jsonPathMatches.some(match => {
        if (!field.filter) {
          return true;
        }

        const typeMatches =
          field.filter.type === undefined || field.filter.type === typeof match;

        if (!typeMatches) {
          console.log(
            '🔍 [CONSTRAINT MATCH] ❌ type check failed:',
            `expected "${
              field.filter.type
            }", got "${typeof match}" for value "${match}"`,
          );
          return false;
        }

        if (field.filter.pattern !== undefined) {
          try {
            const regex = new RegExp(field.filter.pattern);
            const patternMatches = regex.test(String(match));
            console.log(
              '🔍 [CONSTRAINT MATCH] pattern check:',
              `/${field.filter.pattern}/.test("${match}") =`,
              patternMatches,
            );
            if (!patternMatches) {
              console.log(
                '🔍 [CONSTRAINT MATCH] ❌ pattern check failed for value:',
                match,
              );
              return false;
            }
          } catch (e) {
            console.error(
              '🔍 [CONSTRAINT MATCH] ⚠️  Invalid regex pattern:',
              field.filter.pattern,
              e.message,
            );
            // Treat invalid regex as no pattern constraint
          }
        }

        console.log(
          '🔍 [CONSTRAINT MATCH] ✅ type + pattern checks passed for value:',
          match,
        );
        return true;
      });
    });
  });
}
function extractAlgFromSdJwt(sdJwtCompact: string): string {
  const parts = sdJwtCompact.trim().split('~');
  const jwt = parts[0];

  const jwtParts = jwt.split('.');
  if (jwtParts.length < 3) {
    throw new Error('Invalid SD-JWT format');
  }

  const headerJson = JSON.parse(base64UrlDecode(jwtParts[0]));
  if (!headerJson.alg) {
    throw new Error('Missing alg in SD-JWT header');
  }
  return headerJson.alg;
}

function base64UrlDecode(input: string): string {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  while (input.length % 4) {
    input += '=';
  }
  return Buffer.from(input, 'base64').toString('utf8');
}

function fetchCredentialBasedOnFormat(vc: any) {
  const format = vc.format;
  let credential;
  switch (format.toString()) {
    case VCFormat.ldp_vc: {
      credential = vc.verifiableCredential.credential;
      break;
    }
    case VCFormat.mso_mdoc: {
      credential = getProcessedDataForMdoc(
        vc.verifiableCredential.processedCredential,
      );
      break;
    }
    case VCFormat.vc_sd_jwt || VCFormat.dc_sd_jwt: {
      credential =
        vc.verifiableCredential.processedCredential.fullResolvedPayload;
      break;
    }
  }
  return credential;
}

function getProcessedDataForMdoc(processedCredential: any) {
  const namespaces =
    processedCredential.issuerSigned?.nameSpaces ??
    processedCredential.nameSpaces;
  const processedData = {...namespaces};
  for (const ns in processedData) {
    const elementsArray = processedData[ns];
    const asObject: Record<string, any> = {};
    elementsArray.forEach((item: any) => {
      asObject[item.elementIdentifier] = item.elementValue;
    });
    processedData[ns] = asObject;
  }
  return processedData;
}
