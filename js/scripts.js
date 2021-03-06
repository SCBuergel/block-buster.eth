// based on https://ethereum.stackexchange.com/a/24238
const promisify = (inner) =>
  new Promise((resolve, reject) =>
    inner((err, res) => {
      if (err) { reject(err) }
      resolve(res);
    })
  );

const proxiedWeb3Handler = {
  get: (target, name) => {              
    const inner = target[name];                            
    if (inner instanceof Function) {                       
      return (...args) => promisify(cb => inner(...args, cb));                                                         
    } else if (typeof inner === 'object') {                
      return new Proxy(inner, proxiedWeb3Handler);
    } else {
      return inner;
    }
  },
};

let proxiedWeb3;
let columnWidth = "200px";

function createResultTable(tableData) {
  var table = document.createElement("table");

  for (let index in tableData) {
    var tr = document.createElement("tr");
    table.appendChild(tr);
    var td1 = document.createElement("td");
    tr.appendChild(td1);
    td1.innerText = tableData[index][0];
    td1.style.fontWeight = "bold";
    var td2 = document.createElement("td");
    tr.appendChild(td2);
    td2.innerText = tableData[index][1];
    td2.style.display = "block";
    td2.style.width = columnWidth;
    td2.style.overflow = "hidden";
    td2.style.textOverflow = "ellipsis";
    td2.style.wordWrap = "normal";
    td2.onclick = toggleExpand;
  }

  return table;
}

function toggleExpand(e) {
  element = e.target;
  if (element.style.wordWrap == "break-word")
    element.style.wordWrap = "normal";
  else
    element.style.wordWrap = "break-word";
}

async function loadBlock(blockNoOrHash) {
  let block = await proxiedWeb3.eth.getBlock(blockNoOrHash);
  if (!block)
    return;
  console.log("got block: " + JSON.stringify(block));
  let percentGasUsed = (100 * block.gasUsed / block.gasLimit).toFixed(2);
  let tableData = [
    [ "Block number:", block.number ],
    [ "Timestamp:", new Date(block.timestamp * 1000).toLocaleDateString() + " - " + new Date(block.timestamp * 1000).toLocaleTimeString() ],
    [ "Transactions:", block.transactions.length.toLocaleString() ],
    [ "Gas limit:", block.gasLimit.toLocaleString() ],
    [ "Gas used:", block.gasUsed.toLocaleString() + " (" + percentGasUsed + "%)" ],
    [ "Miner:", block.miner ],
    [ "Parent block:", block.parentHash ],
    [ "Uncles:", JSON.stringify(block.uncles) ],
    [ "Difficulty:", block.difficulty.toLocaleString() ],
    [ "Total difficulty:", block.totalDifficulty.toLocaleString() ],
    [ "Size:", block.size.toLocaleString() ],
    [ "Extra data:", block.extraData ],
    [ "Hash:", block.hash ],
    [ "Nonce:", block.nonce ],
    [ "Logs bloom:", block.logsBloom ],
    [ "Mix hash:", block.mixHash ],
    [ "Receipts root:", block.receiptsRoot ],
    [ "Sha3Uncles:", block.sha3Uncles ],
    [ "State root", block.stateRoot ],
    [ "Transactions root:", block.transactionsRoot ]
  ];

  // TODO: return list of transactions in block and render in separate tab (paginated)
  return tableData;
}

async function search() {
  let query = document.getElementById("query").value;
  document.getElementById("query").value = ""; // reset search box
  query = query.replace(/ /g,''); // remove all whitespaces
  let tableData;

  if (query.length < 42) { // assume this is a block number
    let blockNo = parseInt(query, 10);
    tableData = await loadBlock(blockNo);
  }
  else if (query.length == 42) { // assume this is an address
    let balance = ((await proxiedWeb3.eth.getBalance(query)) / 1e18).toLocaleString();
    let code = await proxiedWeb3.eth.getCode(query);
    let txCount = (await proxiedWeb3.eth.getTransactionCount(query)).toLocaleString();
    tableData = [
      [ "Address:", query ],
      [ "Balance:", balance + " ETH" ],
      [ "Transaction count:", txCount ],
      [ "Code:", code]
    ];
    // TODO: let user to query storage
  }
  else if (query.length == 66) { // assume this is a tx or block hash
    let tx = await proxiedWeb3.eth.getTransaction(query);
    if (!tx) { // it's not a tx so assume this is a block hash
      tableData = await loadBlock(query);
    }
    else { // it was actually a tx hash, so get the receipt
      let txReceipt = await proxiedWeb3.eth.getTransactionReceipt(query);
      let txData1  = [
        [ "From:", tx.from ],
        [ "To:", tx.to ],
        [ "Value:", (tx.value / 1e18).toLocaleString(undefined, {maximumFractionDigits: 18}) ],
        [ "Transaction hash:", tx.hash ],
        [ "Input:", tx.input ],
        [ "Nonce:", tx.nonce.toLocaleString() ],
        [ "Signature (r, s, v):", tx.r + ", " + tx.s + ", " + tx.v ],
        [ "Transaction index:", tx.transactionIndex.toLocaleString() ]
      ]
      if (txReceipt) { // tx already mined
        let txData2 = [
          [ "Block hash:", txReceipt.blockHash ],
          [ "Block number:", txReceipt.blockNumber.toLocaleString() ],
          [ "Gas used / limit:", txReceipt.gasUsed.toLocaleString() + " of " + tx.gas.toLocaleString() + " (" + (txReceipt.gasUsed / tx.gas * 100).toFixed(2) + "%)"],
          [ "Gas price: ", (tx.gasPrice / 1e9) + " GWei" ],
          [ "Transaction fee: ", (tx.gasPrice * txReceipt.gasUsed / 1e18).toLocaleString(undefined, {maximumFractionDigits: 18}) + " ETH" ],
          [ "Cumulativ gas used:", txReceipt.cumulativeGasUsed.toLocaleString() ],
          [ "Logs:", txReceipt.logs.length.toLocaleString() ],
          [ "Logs bloom:", txReceipt.logsBloom ],
          [ "Root:", txReceipt.root ],
          [ "TransactionIndex:", txReceipt.transactionIndex ]
        ];
        tableData = txData1.concat(txData2);
        // TODO: retrieve logs and render in separate tab
      }
      else { // tx still pending
        let txData0 = [
          [ "Pending transaction!", "This transaction has not been mined yet. If you submitted this transaction, you can increase the gas price to speed it up" ]
        ];
        tableData = txData0.concat(txData1);
      }
    }
  }

  // now render the results
  let results = document.getElementById("results");
  results.textContent = ""; // remove previously existing search results
  if (tableData) {
    let table = createResultTable(tableData);
    results.appendChild(table);
  } else {
    let div = document.createElement("div");
    div.innerText = "No block number, block hash or transaction hash found :( You were looking for: " + query;
    results.appendChild(div);
  }
}

function createWeb3() {
	// create web3 object (because web3 endpoint might have changed)
	let endpointInput = document.getElementById("web3Endpoint").value;
  let endpoint;

  // first try to use the default value (if that's written in input field):
  if (endpointInput == "window.ethereum") {
    // if that does not exist, update UI and try fallback to Avado RYO
    if (typeof window.ethereum == "undefined") {
    	console.log("cannot find window.ethereum, switching to Avado RYO...");
    	endpoint = "https://mainnet.eth.cloud.ava.do";
    	document.getElementById("web3Endpoint").value = "https://mainnet.eth.cloud.ava.do";
    	document.getElementById("outputDiv").innerHTML = "<b>Did not find local web3 provider, switched to <a href='https://status.cloud.ava.do/' target='_blank'>Avado Run-Your-Own Cloud</a>.</b>";
    } else {
    	endpoint = window.ethereum;
    }
  } else {
    // otherwise just try to use the one provided
    endpoint = endpointInput;
  }

  // finally create the objects and try using that endpoint to obtain the latest block number to see if all is ok
  let web3 = new Web3(endpoint);
  proxiedWeb3 = new Proxy(web3, proxiedWeb3Handler);
}

// TODO: add button to reload web3 endpoint and show some basic node stats

window.onload = function() {
	createWeb3();
}
