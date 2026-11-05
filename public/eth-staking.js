// User wallets send transactions; the server only verifies state and prepares typed calls.
(function () {
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const units=value=>{const n=BigInt(value||'0'),f=String(n%10n**18n).padStart(18,'0').replace(/0+$/,'');return String(n/10n**18n)+(f?'.'+f:'');};
  const parse=value=>{
    if(typeof value!=='string'||value.length>98||!/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(value))return null;
    const [whole,fraction='']=value.split('.'),n=BigInt(whole)*10n**18n+BigInt(fraction.padEnd(18,'0'));
    return n>0n&&n<(1n<<256n)?n:null;
  };
  const date=value=>{const d=new Date(Number(value)*1000);return Number.isFinite(d.getTime())?d.toLocaleString():'Date unavailable';};
  const lower=value=>String(value||'').toLowerCase();
  const fail=message=>{throw new Error(message);};
  // Verify the complete, fixed ABI intent against the independently encoded server proposal.
  const word=(value,max=(1n<<256n)-1n)=>{
    if((typeof value==='number'&&!Number.isSafeInteger(value))||String(value).length>78||!/^(0|[1-9]\d*)$/.test(String(value)))fail('Invalid staking number.');
    const n=BigInt(value);if(n>max)fail('Invalid staking number.');return n.toString(16).padStart(64,'0');
  };
  const addressWord=value=>{if(!/^0x[0-9a-f]{40}$/i.test(value||''))fail('Invalid staking wallet.');return value.slice(2).toLowerCase().padStart(64,'0');};
  function intentCalldata(intent,wallet,vault){
    const own=addressWord(wallet),spender=addressWord(vault);
    if(intent.action==='register')return'0x779beedf'+own;
    if(['approve','stake','withdraw'].includes(intent.action)){
      const n=parse(intent.amount);if(n===null)fail('Enter a positive OMR amount with at most 18 decimal places.');
      if(intent.action==='approve')return'0x095ea7b3'+spender+word(n);
      if(intent.action==='stake')return'0xa694fc3a'+word(n);
      return'0x0ad58d2f'+word(intent.lockId)+word(n)+own;
    }
    if(intent.action==='claim'){
      if(!Array.isArray(intent.epochs)||!intent.epochs.length||intent.epochs.length>24)fail('Select earned reward periods.');
      const ids=intent.epochs.map(id=>word(id,(1n<<64n)-1n));
      if(intent.epochs.some((id,i)=>i&&BigInt(id)<=BigInt(intent.epochs[i-1])))fail('Select unique reward periods.');
      return'0x6c68279f'+word(64)+own+word(ids.length)+ids.join('');
    }
    fail('Unsupported staking action.');
  }
  async function mount(root,{api,pickProvider,toast,linkWallet}){
    let board=null,busy=false,positionOffset='0',epochOffset='0',notice='';
    const connected=()=>root.isConnected;
    const message=text=>{notice=text;const status=root.querySelector('[data-eth-status]');if(status)status.textContent=text;};
    async function load(){
      if(!connected())return;message('Reading verified staking balances…');
      try{
        const r=await api('GET','/v1/eth-staking?positions='+encodeURIComponent(positionOffset)+'&epochs='+encodeURIComponent(epochOffset));
        if(r.code!==200)throw new Error('Staking balances are unavailable.');board=r.body;notice='';render();
      }catch{board=null;notice='Staking balances cannot be verified right now. Try refreshing.';render();}
    }
    function pages(kind,previous,next){return '<p>'+(previous!==null?'<button class="act" data-eth-page="'+kind+'" data-offset="'+esc(previous)+'" type="button">Newer '+kind+'</button> ':'')
      +(next!==null?'<button class="act" data-eth-page="'+kind+'" data-offset="'+esc(next)+'" type="button">Older '+kind+'</button>':'')+'</p>';}
    function render(){
      if(!connected())return;
      const intro='<h2>ETH rewards</h2><p class="d">Stake wallet OMR for native ETH trading-fee rewards. Each deposit has its own 30-day minimum withdrawal lock. After day 30 it keeps earning until you withdraw; no renewal is required. This is separate from gameplay staking. No protocol tax applies to staking, withdrawal or claims; network gas applies. Rewards depend on actual fees, with no fixed return.</p>';
      if(!board?.available){
        root.innerHTML=intro+'<p class="d">'+esc(board?.reason||notice||'ETH staking is not active in this deployment.')+'</p>'
          +(board?.needsWallet?'<button class="act" data-eth-link type="button">Link wallet</button>':'')
          +'<button class="act" data-eth-refresh type="button">Refresh</button><p class="d" data-eth-status role="status" aria-live="polite"></p>';
        root.querySelector('[data-eth-link]')?.addEventListener('click',()=>linkWallet());root.querySelector('[data-eth-refresh]').addEventListener('click',load);return;
      }
      const claimIds=board.epochs.filter(e=>e.finalized&&BigInt(e.claimableWei)>0n).map(e=>e.id).sort((a,b)=>BigInt(a)<BigInt(b)?-1:1);
      root.innerHTML=intro+'<p class="d">Linked wallet: '+esc(board.wallet)+'</p>'
        +'<div class="grid"><div class="card"><span class="t">Earning rewards</span><div>'+esc(units(board.stakedWei))+' OMR</div></div>'
        +'<div class="card"><span class="t">Within withdrawal lock</span><div>'+esc(units(board.lockedWei))+' OMR</div></div>'
        +'<div class="card"><span class="t">Mature and withdrawable</span><div>'+esc(units(board.withdrawableWei))+' OMR</div></div>'
        +'<div class="card"><span class="t">Wallet balance</span><div>'+esc(units(board.balanceWei))+' OMR</div></div></div>'
        +(!board.active?'<p class="d">Staking is awaiting activation.</p>':board.paused?'<p class="d">New deposits are paused. Mature withdrawals and earned claims remain available.</p>':'')
        +(!board.eligible?'<p class="d">This wallet is not eligible to open new staking positions.</p>':'')
        +(board.canRegister?'<p class="d">Register your wallet with OMR before approving a stake.</p><button class="act" data-eth-register type="button">Register wallet</button>':'')
        +'<div class="card"><label class="d">Amount of wallet OMR <input data-eth-amount inputmode="decimal" maxlength="98" autocomplete="off" placeholder="100" aria-label="OMR amount to stake"></label>'
        +'<div style="margin-top:8px"><button class="act" data-eth-approve type="button" disabled>Approve exact amount</button> <button class="act" data-eth-stake type="button" disabled>Stake for ETH rewards</button></div>'
        +'<p class="d">Approval grants this vault permission for only the amount entered. Wait for approval confirmation before staking. Each new stake starts a separate 30-day withdrawal timer.</p></div>';
      // Positions and claim controls are appended below, then bound to typed actions.
      renderActions(claimIds);
    }
    function renderActions(claimIds){
      root.innerHTML+='<h3>Your positions</h3>'+(board.positions.length?board.positions.map(p=>'<div class="card"><span class="t">Position '+esc(p.id)+'</span><p class="d">'+esc(units(p.amountWei))+' OMR · '
        +(BigInt(p.amountWei)===0n?'withdrawn':p.matured?'Mature; still earning until withdrawn.':'Withdrawable after '+esc(date(p.unlocksAt)))+'</p>'
        +(p.canWithdraw?'<label class="d">OMR to withdraw <input data-eth-withdraw-amount="'+esc(p.id)+'" inputmode="decimal" maxlength="98" value="'+esc(units(p.amountWei))+'" aria-label="Amount to withdraw from position '+esc(p.id)+'"></label> <button class="act" data-eth-withdraw="'+esc(p.id)+'" type="button">Withdraw to linked wallet</button>':'')+'</div>').join(''):'<p class="d">No positions on this page.</p>')
        +pages('positions',board.previousPositionsOffset,board.nextPositionsOffset)
        +'<h3>Earned ETH</h3><p class="d">'+esc(units(board.claimableOnPageWei))+' ETH claimable on this page. Periods settle after they close; earlier earned rewards remain claimable after withdrawal.</p>'
        +(board.epochs.length?'<ul>'+board.epochs.map(e=>'<li>Period '+esc(e.id)+': '+(!e.finalized?'awaiting finalization':esc(units(e.claimableWei))+' ETH claimable')+'</li>').join('')+'</ul>':'<p class="d">No closed reward periods yet.</p>')
        +'<button class="act" data-eth-claim type="button"'+(!claimIds.length?' disabled':'')+'>Claim earned ETH on this page</button>'
        +pages('epochs',board.previousEpochsOffset,board.nextEpochsOffset)
        +'<p><button class="act" data-eth-refresh type="button">Refresh confirmed balances</button></p><p class="d" data-eth-status role="status" aria-live="polite">'+esc(notice)+'</p>';
      const input=root.querySelector('[data-eth-amount]');
      input.addEventListener('input',()=>{
        const n=parse(input.value),valid=board.canStake&&n!==null&&n<=BigInt(board.balanceWei)&&!busy;
        root.querySelector('[data-eth-approve]').disabled=!valid||BigInt(board.allowanceWei)>=n;
        root.querySelector('[data-eth-stake]').disabled=!valid||BigInt(board.allowanceWei)<n;
      });
      root.querySelector('[data-eth-approve]').onclick=()=>submit({action:'approve',amount:input.value});
      root.querySelector('[data-eth-stake]').onclick=()=>submit({action:'stake',amount:input.value});
      root.querySelector('[data-eth-register]')?.addEventListener('click',()=>submit({action:'register'}));
      root.querySelector('[data-eth-claim]').onclick=()=>submit({action:'claim',epochs:claimIds});
      root.querySelectorAll('[data-eth-withdraw]').forEach(button=>button.onclick=()=>submit({action:'withdraw',lockId:button.dataset.ethWithdraw,
        amount:root.querySelector('[data-eth-withdraw-amount="'+button.dataset.ethWithdraw+'"]').value}));
      root.querySelector('[data-eth-refresh]').onclick=load;
      root.querySelectorAll('[data-eth-page]').forEach(button=>button.onclick=()=>{if(busy)return;
        if(button.dataset.ethPage==='positions')positionOffset=button.dataset.offset;else epochOffset=button.dataset.offset;load();});
    }
    async function submit(intent){
      if(busy||!board?.available)return;busy=true;root.querySelectorAll('button').forEach(b=>b.disabled=true);
      try{
        const provider=await pickProvider();if(!provider){message('Connect your linked wallet to continue.');return;}
        const accounts=await provider.request({method:'eth_requestAccounts'}),from=accounts?.[0];
        if(lower(from)!==lower(board.wallet))fail('Select the wallet linked to this account.');
        await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x1237'}]});
        if(BigInt(await provider.request({method:'eth_chainId'}))!==4663n)fail('Switch your wallet to Robinhood Chain.');
        // Prepare after any approval confirmation; never reuse a pre-approval stake call.
        const prepared=await api('POST','/v1/eth-staking/transaction',intent);
        if(prepared.code!==200)fail(prepared.body?.error||'The transaction cannot be verified.');
        const tx=prepared.body,expected=intent.action==='approve'||intent.action==='register'?board.token:board.vault;
        if(tx.action!==intent.action||tx.chainId!==4663||lower(tx.from)!==lower(from)||lower(tx.to)!==lower(expected)
          ||tx.value!=='0x0'||!/^0x[0-9a-f]+$/i.test(tx.data||'')||!/^[0-9]+$/.test(tx.expiresAt||'')
          ||BigInt(tx.expiresAt)<BigInt(Math.floor(Date.now()/1000)))fail('The staking call changed or expired. Refresh and try again.');
        if(lower(tx.data)!==intentCalldata(intent,from,board.vault))fail('The prepared transaction does not match your staking request. Refresh and try again.');
        const selected=await provider.request({method:'eth_accounts'});
        if(lower(selected?.[0])!==lower(from)||BigInt(await provider.request({method:'eth_chainId'}))!==4663n)fail('The selected wallet or chain changed. Refresh and try again.');
        const pinned=await provider.request({method:'eth_getBlockByNumber',params:['0x'+BigInt(tx.blockNumber).toString(16),false]});
        if(lower(pinned?.hash)!==lower(tx.blockHash))fail('The chain changed. Refresh the staking call.');
        await provider.request({method:'eth_call',params:[{from,to:tx.to,data:tx.data,value:'0x0'},'latest']});
        const finalAccounts=await provider.request({method:'eth_accounts'});
        if(lower(finalAccounts?.[0])!==lower(from)||BigInt(await provider.request({method:'eth_chainId'}))!==4663n
          ||BigInt(tx.expiresAt)<BigInt(Math.floor(Date.now()/1000)))fail('The wallet, chain or prepared call changed. Refresh and try again.');
        const hash=await provider.request({method:'eth_sendTransaction',params:[{from,to:tx.to,data:tx.data,value:'0x0',chainId:'0x1237'}]});
        if(!/^0x[0-9a-f]{64}$/i.test(hash||''))fail('The wallet did not return a transaction hash. Check its activity before trying again.');
        message('Submitted. Waiting for confirmation; network gas applies.');
        let receipt=null;
        for(let i=0;i<30&&connected();i++){receipt=await provider.request({method:'eth_getTransactionReceipt',params:[hash]});
          if(receipt)break;await new Promise(resolve=>setTimeout(resolve,1500));}
        if(!connected())return;
        if(receipt&&BigInt(receipt.status)!==1n)fail('The transaction reverted. Check the wallet receipt; network gas may have been charged.');
        toast(receipt?'Transaction confirmed. Refreshing verified balances.':'Still pending. Refresh after confirmation; do not resubmit it.');
        positionOffset='0';await load();
      }catch(e){const text=e?.code===4001?'Transaction cancelled.':e?.message||'Wallet transaction unavailable. No automatic retry was sent.';message(text);toast(text,true);}
      finally{busy=false;if(connected()&&board?.available)render();}
    }
    render();await load();
  }
  window.OmertaEthStaking=Object.freeze({mount,formatUnits:units,parseAmount:parse,intentCalldata});
}());
