// Exact committed auth successor inputs for fresh native qualification; no inherited results.
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const ENTERPRISE_NATIVE_X_AUTH_INPUTS=freeze({
  "status": "SEALED",
  "revision": "c0f6219bd981961513ce0251cf2121407677771a",
  "predecessor": "59dbb6d99312fa44dba1fbec5bdf24948740e0dc",
  "catalogRevision": "cc4879958f69e23aa0d38571739db31e4cf253ed",
  "legacyBaseRevision": "5909e505513186136f19c0d76997359321594926",
  "replacements": [
    {
      "file": "public/index.html",
      "before": {
        "blob": "6221711be794023ee60c53f2039795d14be7cf65",
        "sha256": "9f8baaf26731853d89fde6015e51f5355f23ef0347fb0a850f3ad4edfa771951",
        "mode": "100644"
      },
      "after": {
        "blob": "455c60fa834eb28162837bed530381d47625f0e4",
        "sha256": "37dd6cc252fd828fb9da47243fa5e3b3b1485cd5774ee63f7088af7a84f760c9",
        "mode": "100644"
      }
    },
    {
      "file": "public/invite.html",
      "before": {
        "blob": "b07f1e538492b6968da759e893d45570173878bc",
        "sha256": "55b49c18eaeb928b0ce914b3d2e0617c2fcd7fd3dcfe853dbf78b801ea4247a3",
        "mode": "100644"
      },
      "after": {
        "blob": "93ad27a00bec2a1e9318002471496a3229857ab5",
        "sha256": "3fd29499d7b6f9d07c7a1fb09c8c56e3e0e5d84c8c642f79ee3315282c8c49ca",
        "mode": "100644"
      }
    },
    {
      "file": "src/agentgateway.js",
      "before": {
        "blob": "99dff0e486012d7fe50a94aef91f000a6539d499",
        "sha256": "e7b51ba30ab4773dc9224cab005ca476b6f172d80f2bc1a608cf780fbc083c76",
        "mode": "100644"
      },
      "after": {
        "blob": "d8c2a2216861c43e5f606d65847e4617efabb775",
        "sha256": "ca2dd7ed8c646b140ab736c2b5e8e4b7f1835fd484b3c9d3ce32cf1c154d1114",
        "mode": "100644"
      }
    },
    {
      "file": "src/auth.js",
      "before": {
        "blob": "85d8367ef7a4db8d273096ddcbc2434a63c9e849",
        "sha256": "4214410b28d33159b95c4b3c2a203c99694653786a13bf33a835abb7d58a49ce",
        "mode": "100644"
      },
      "after": {
        "blob": "3b71b45209dc4153bb0abe1d9002e7b42cd70e0f",
        "sha256": "393ebb474ede48b89cd8a04775de2f3da388eb19cb6c33533023a00673e77dda",
        "mode": "100644"
      }
    },
    {
      "file": "src/legal.js",
      "before": {
        "blob": "70942fdd7dfd2848988280ffdfdd70a760197ec8",
        "sha256": "cc9d56d27c0630d67dc2cdc1d53a8ff3fc294d7e2faa86a49a1fe1d15b1fa9b6",
        "mode": "100644"
      },
      "after": {
        "blob": "58f09fe6b2d07820e5f37f33414a2304a2b3a4fc",
        "sha256": "447df1641995899da455d74ae8e185563cabebc5dbfc3cf77db35b242e8d78b1",
        "mode": "100644"
      }
    },
    {
      "file": "src/server.js",
      "before": {
        "blob": "a04c65a36f8b947cbea45b31f7eb11a81b080ced",
        "sha256": "f1f043bff054253932104d00c8d132c6b64ebdde9b306b87c89a1b37e473c038",
        "mode": "100644"
      },
      "after": {
        "blob": "e7f936c6bd5c1638cadfbb26e4fafc7507c734b2",
        "sha256": "f775f051089211078de8336535515d4a76a815e6dee861b22ad242bc745e16a9",
        "mode": "100644"
      }
    },
    {
      "file": "test/auth-fixture.js",
      "before": {
        "blob": "1d4dad44930dfcaea2ec5025bd46fae2bf111449",
        "sha256": "5563c246cc7e679a122d52624a1180523f668d6bb9d181585a8b34d89166b995",
        "mode": "100644"
      },
      "after": {
        "blob": "eaece92a91dd00a4fa1f9ae19f33e292ed3d5525",
        "sha256": "8b7a7bb23ca0dd9095c7e7c66518db95c3d11d5ac24560fc821a9aa211c9c225",
        "mode": "100644"
      }
    },
    {
      "file": "test/continuous-city-source-compatibility.js",
      "before": {
        "blob": "d7b36dc4af2b59c8668a4db0db25caeea6d62c57",
        "sha256": "a20e83f44ba73b784c3a58763997e1cc29458668fb590aa2df5da14325b09a32",
        "mode": "100644"
      },
      "after": {
        "blob": "62be9aae44b01dd67ab7c065e98159b66f6b5d25",
        "sha256": "b4813defdbcac101899c08ea79dea0f6998ac106607fab1f443efdd7300b1e14",
        "mode": "100644"
      }
    },
    {
      "file": "test/gates.js",
      "before": {
        "blob": "6708777c99763883b8fa6b5eff2b710ad4be874c",
        "sha256": "c90d22bb4dfcf4091134544e9b28889ff90b18c7a60cd998d8bef351dc93be51",
        "mode": "100644"
      },
      "after": {
        "blob": "4e6ef6b175500528b7b8839b9b79b6404462516f",
        "sha256": "b237b24a099bd1f47817df0a4e8ddb2cd58755ba55b7062410539f1f7a386f23",
        "mode": "100644"
      }
    },
    {
      "file": "test/server-fixture.js",
      "before": {
        "blob": "565a699bd4f67a3d248f420a04fe81d41473ae96",
        "sha256": "4d12bb8a43b460e89a93046c31368316e795659879455d9198b5f0b071c478cf",
        "mode": "100644"
      },
      "after": {
        "blob": "3084990c67d4cb631177865aab0ea4bb060dd207",
        "sha256": "746c822666cf10fdbd0cb9fe7ab7e38d960e38387e18f2c67cac88734724b523",
        "mode": "100644"
      }
    },
    {
      "file": "tools/continuous-city-source-compatibility.js",
      "before": {
        "blob": "dbb7423a122854dab35e244bc369f2ff7b43e81f",
        "sha256": "646e3b3d17cd8f2e19d16990f4741406365343abd0acfe136010031b3ff4d862",
        "mode": "100644"
      },
      "after": {
        "blob": "72f405f4b4e7a8bde369485e2a00b31e8cc9b4df",
        "sha256": "02e78f3ea138a121dfa20d79dd672bde573011a330157c69347a8ce3dcd3dc5f",
        "mode": "100644"
      }
    }
  ],
  "removals": [
    {
      "file": "src/age.js",
      "before": {
        "blob": "314806666a9f590e4755aa50707d40adcfbde0db",
        "sha256": "70aa08ad07eba867d8b4c0fd7ced892e7e1871869c03832295d60ee78331e0ff",
        "mode": "100644"
      }
    }
  ],
  "additions": [
    {
      "file": "tools/x-auth-source-compatibility.js",
      "blob": "172b583af69b9ef9acee0d158e8930a3f250075f",
      "sha256": "96716237be3fba16ccf89935ff4c332f17c368cc5e429e5a63d81a7706ca7d6a",
      "mode": "100644"
    }
  ]
});
