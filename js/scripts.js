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

// from https://github.com/30-seconds/30-seconds-of-code/blob/master/snippets/median.md
const median = arr => {
  const mid = Math.floor(arr.length / 2),
    nums = [...arr].sort((a, b) => a - b);
  return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
};

const average = list => list.reduce((prev, curr) => prev + curr) / list.length;

let proxiedWeb3;
let numBlocks = 10;
let txs = new Map();
let running = false;
let globalMinGasGWei = Number.MAX_SAFE_INTEGER;
let globalMaxGasGWei = Number.MIN_SAFE_INTEGER;
const numBins = 40;

function createBlockTable(tableData) {
  var table = document.createElement("table");

  for (let index in tableData) {
    var tr = document.createElement("tr");
    table.appendChild(tr);
    var td1 = document.createElement("td");
    tr.appendChild(td1);
    td1.innerText = tableData[index][0];
    var td2 = document.createElement("td");
    tr.appendChild(td2);
    td2.innerText = tableData[index][1];
  }

  return table;
}

async function search() {
  let query = document.getElementById("query").value;
  query = query.replace(/ /g,''); // remove all whitespaces
  let results = document.getElementById("results");
  results.textContent = ""; // remove previously existing search results

  if (query.length < 42) { // assume this is a block number
    let blockNo = parseInt(query, 10);
    let block = await proxiedWeb3.eth.getBlock(blockNo);
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
      [ "Difficulty:", block.difficulty ],
      [ "Total difficulty:", block.totalDifficulty ],
      [ "Size:", block.size ],
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

    let table = createBlockTable(tableData);
    results.appendChild(table);
  }
  else if (query.length == 42) { // assume this is an address
    console.log("searching tx or block hash " + query);
    let balance = await proxiedWeb3.eth.getBalance(query);
    console.log("balance: " + balance);
    let code = await proxiedWeb3.eth.getCode(query);
    console.log("code:" + code);
    let txCount = await proxiedWeb3.eth.getTransactionCount(query);
    console.log("nonce: " + txCount);
  }
  else if (query.length == 66) { // assume this is a tx or block hash
    console.log("searching block hash " + query);
  }
}

function findSmallestNonZero(data) {
	let smallest = Number.MAX_SAFE_INTEGER;
	for (let c = 0; c < data.length; c++) {
		if (data[c] < smallest && data[c] > 0) {
			smallest = data[c];
		}
	}
	return smallest;
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
  //console.log("now creating web3 object...");
  let web3 = new Web3(endpoint);
  proxiedWeb3 = new Proxy(web3, proxiedWeb3Handler);
}

window.onload = function() {
	createWeb3();
}
