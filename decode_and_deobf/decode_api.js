// api.js string tablosunu decode et → field isimlerini bul
const ALPHA = `}>J2Nt.^m7IH]uWGqF5lR)"TP<0h?,Kn%@EzD[:bgopj|3wd(C1s;S+{$rBaxYVfZcvyAi\`ek&/!L=M_Q68#4OX9*~U`;

function decode(str) {
    const c = ALPHA;
    const d = "" + (str || "");
    const e = d.length;
    const f = [];
    let g = 0, h = 0, j = -1;
    for (let k = 0; k < e; k++) {
        let l = c.indexOf(d[k]);
        if (l === -1) continue;
        if (j < 0) { j = l; }
        else {
            j += l * 91;
            g |= j << h;
            h += (j & 8191) > 88 ? 13 : 14;
            do { f.push(g & 255); g >>= 8; h -= 8; } while (h > 7);
            j = -1;
        }
    }
    if (j > -1) f.push((g | j << h) & 255);
    return Buffer.from(f).toString("utf8");
}

// api.js'den alınan d[] array'i (ilk 60 eleman)
const dArr = [
    "@j{Lk66>",
    "$3&%L:e^TBw;hWel%,Wn1!UgN+7T~D%5LA>!B`v/@7",
    "Tca%#ibz~RvwVitnIA9;G:h,(f?I06xTIw4/sb^o~BH!#Wq06$OLGr.P:Zz",
    "iAy/%+4Biu",
    "~2[I.//]=Wr^JYKPo/h%HVbdaRsQ4#*Ebs`&+`WXM$aWS([P#E5%?MPwl+2.>",
    "2G>Kx_4/(]:^$2>T}+VNZBAXs71$Cq1?MH|=_6AAE++",
    "Ya_;E;?]^Z/y}4t<,/_C|!Oud5#H[q%FpcJ",
    "^/WnH:kKwaY?I[:P%/|/2k_r(S!=MJ@nk}",
    "@2x,eDKPF]72>",
    "7/^7(!czErq.9:RE>,9C@;!,n5Rnb0Bp",
    "M3#,EQ[uLS159:?z/WXexBorRrY<De7",
    "<A!ShaRJ8f$",
    "R7z,7x}K]FS",
    "S0.;TL[uE]HE+COg2zKN",
    "@xIhd8tlUW",
    "N0wngQZK(]",
    "3s)n1`}",
    "fF[ny6azBa#=nJ`l$a`{i(+JBa@a(2,p<GMNn+Y>",
    "R]E!wf.wK)=/8:!0D0R/v(/P4+s&rkKKm>",
    "ngu^G1kKC+D_Eu1hipySKYG^@f{?>",
    "nGI!Axmm!aOGqdzK)>",
    '"x3/MV@z>5=moN`ncg2kBSGud]eC|eXq<cm7x(&^oc]Ah0`<K>',
    "{e.7lV)6%5CQNqrpXcIsfBRQnfrWd8U?8[2",
    "C[zk~L1Zsr2hnJJn)xD,$4.P3$l8Dh%,MAeN&(5;)Z!/sBen+gZ7",
    "jne;f=!r7R<{jWazb/2",
    "5[5s/6a>",
    "f[1h>w,^(Gi%,(>nz0>K3Ak]35tB*dXq&H|=o$3u^I|",
    "*b$+6@PQCfNd|dapO.d?Te$KUcY<{W]:X&(.%z3^XlMHJ<cTF5\"^`_1wt",
    ")x4eI6olCGN8<D>PtAMChrs^S+IIO(Wg,cj/&6]PIaAmu(zK",
    "MFl,p$8wjm&%|a%5oFk7vkA]<BGkjhYFPG>!l",
    "pslI;b6u:u>7hJwlMAPMXLs^Nr$`g2>K#E2",
    "%GLtfb;w,V%igN<T1+TCHiXwdxk=gd1gVWQ7Y4}",
    "C[oKfEY!l7_Sl1Oh$.vsf/APjVf>}2",
    "w]Fhj+`K7WA<B[.[{eLeEaef#lca>",
    "@rR,VE,l%)x=o<2F/s6+S4:K.BTLn2)g_3E=@Qefn)q_016g#}",
    "]fxnpYJDLV^2[qm",
    "?cn.$b[6N",
    "I[f?xxsuA+|veB#EO.LtoCt9zr/=khN[dg<+9;N57cA=]4.",
    "Hfz=[Q\"B$uX`Re2jVV!t+fS>",
    "~Wg&^E`]@5f`pB[nK[PKy6j^}rqVv[i<`V/,O#cTzr_w$G>D},J",
    "r+Kn{BKD5x..^1xzO<R/zMg]$c!5uxe:,E5kuiO^N71&f:~qeFF!v6ou|)",
    "Hr!,ZB>zoFZ;7(>F,c;,SBl>d$CvcNcnxFb?}DsloVr`K[0obr!1?a=^bRDk}",
    "[TsmmXm5YSUyxGso|R{&Z_S^HcI2z80?KGu^g&3^wfB%0Cjld0eNx_,dam",
    "me0,Xi4ENZf^Fqkn_[X?Yk)l&Wl.hW4?VTi/VwloM5&HM6TE!W)/Z(#>=$o",
    "{ed&L{SzEx52;2OgV2!=yk&>[ZCW.t",
    "6.W^c_>uJ]X>rDAnxAB=Sfor>ri=j`tnPA9;%zIPIar)s:<o9a#={`5Pvl",
    "nx3^bYtSLWLH#0@K]wZ7d[Ti5]uhZGL<O}",
    "_FV{zYt>",
    "8n$.c6:D.",
    "gry,O1?ZXBm!\"61E=.\"{Q/duOl5s&kb:8Wl,K;q;bu/&Biz<Frqs&ry>",
    "SRKn3QCl~R",
    "$Ae+C4XB}5RImhcn;3TC,OAwWGY",
    "#<z%XM];(]{v7Dcnc&Ync{NmtZx",
    "q5y=wYO^N+b",
    "RgKL9M=uJ]v5P2",
    "d]Hk&r]B}5dW{B&b4Wg+3Q.;OB8HF(}DX?,{^X^lI{JEkGrz}wxI4#3>",
    "ObA,(C~>;uUw~xjl$WJ",
    "gTTL~;NpDuRI^09gpeL,Ez&,URD^H:`:y}",
    "rgP.+4hdwH@W;Gwbzx\"73A{dRusVW[cF$}",
    ")r7s9e&s>rU1oq(glwVCb+Cz;u4S2:I",
];

console.log("=== api.js d[] strings decoded ===");
for (const [i, s] of dArr.entries()) {
    try {
        const r = decode(s);
        // sadece printable ASCII göster
        const clean = r.replace(/[^\x20-\x7e]/g, "·");
        console.log(`  d[${i.toString().padStart(2)}] = ${JSON.stringify(clean)}`);
    } catch (e) {
        console.log(`  d[${i}] = ERROR: ${e.message}`);
    }
}
