/**
 *       __    Kookie - a EU-law cookie consent helper library
 *      /\_\
 *   /\/ / /   Copyright 2012, Konfirm (Rogier Spieker)
 *   \  / /    Releases under the MIT and GPL licenses
 *    \/_/     More information: http://konfirm.net/kookie
 */
;var Kookie = Kookie||new(function(){
	var kookie = this;

	//  initialization
	kookie.init = function(config)
	{
		kookie._enterState(kookie.state.INIT);

		kookie.config = kookie._mergeObjects(config, kookie.defaultConfig);
		kookie.geo    = {code:'',country:'',continent:''};

		kookie.addStateListener(kookie.state.CONFIG, function(){kookie._configure()});

		if (kookie.config.respectDoNotTrack && kookie._doNotTrack())
			return kookie._enterState(kookie.state.DO_NOT_TRACK);

		kookie._leaveState(kookie.state.INIT);
	};
	kookie.delayInit = function(config)
	{
		var call = function(){kookie.init(config);};
		if (typeof window.addStateListener != "undefined")
			window.addStateListener('DOMContentLoaded', call, false);
		else
			window.onload = call;
	};

	//  common methods
	kookie.askUserConsent = function()
	{
		kookie.createConsentInterface();
	};
	kookie.userConsent = function(doAllowTracking)
	{
		kookie.setConsentCookie(doAllowTracking);
	};
	kookie.revokeConsent = function()
	{
		kookie.setConsentCookie(false);
	};
	kookie.setGeoLocation = function(location)
	{
		kookie.geo = location;
		kookie._leaveState(kookie.state.CONFIG);
	};
	kookie.getGeoLocation = function()
	{
		return kookie.geo;
	};

	//  visual appearance
	kookie.getInterfaceStructure = function()
	{
		if (typeof kookie.structure == 'undefined')
		{
			var container = document.body.insertBefore(document.createElement('div'), document.body.firstChild),
				  content = container.appendChild(document.createElement('div')),
				 question = content.appendChild(document.createElement('span')),
				     more = container.appendChild(document.createElement('button')),
				   action = content.appendChild(document.createElement('span'));

			kookie.structure = {
				container:container,
				 content:content,
				question:question,
				    more:more,
				  action:action,
				 explain:content.appendChild(document.createElement('div')),
				 consent:action.appendChild(document.createElement('button')),
				 decline:action.appendChild(document.createElement('button'))
			};
		}
		return kookie.structure;
	};
	kookie.removeInterfaceStructure = function()
	{
		if (typeof kookie.structure != 'undefined')
		{
			kookie.structure.container.parentNode.removeChild(kookie.structure.container);
			delete kookie.structure;
		}
	};
	kookie.createConsentInterface = function()
	{
		var structure = kookie.getInterfaceStructure(),
		         p, s;

		for (p in structure)
		{
			structure[p].className = 'kookie_' + p;
			if (typeof kookie.config.style[p] == 'object')
				for (s in kookie.config.style[p])
					structure[p].style[s] = kookie.config.style[p][s];

			if (typeof kookie.config.text[p] != 'undefined')
			{
				if (/button/i.test(structure[p].nodeName))
					structure[p].appendChild(document.createTextNode(kookie.config.text[p]));
				else
					structure[p].innerHTML = kookie.config.text[p];
			}
		}

		structure.consent.onclick = function(){
			kookie.userConsent(true);
			kookie.removeInterfaceStructure();
		};

		structure.decline.onclick = function(){
			kookie.userConsent(false);
			kookie.removeInterfaceStructure();
		};

		structure.more.onclick = function(){
			kookie.structure.more.style.display    = 'none';
			kookie.structure.explain.style.display = 'block';
		};
	};

	//  external script loading
	kookie.loadScript = function(src, callback, cleanUp)
	{
		var script  = document.createElement('script'),
		  onReady   = callback || function(){};
		if (cleanUp)
			callback = function(){callback();script.parentNode.removeChild(script)};
		script.type = "text/javascript";
		if (script.onreadystatechange)
			script.onreadystatechange = function(){if(/complete|loaded/.test(this.readyState))onReady()};
		else if (typeof script.onload != 'undefined')
			script.onload = onReady;
		else
			kookie._scriptLoadPolling(onReady);
		script.src = src;
		(document.head || document.getElementsByTagName('head')[0] || document.body).appendChild(script);
	};
	kookie._scriptLoadPolling = function(callback)
	{
		//  IE 7 and older don't support (all) onreadystatechange/onload events, we poll the callback function to see if it's loaded
		clearTimeout(kookie._scriptLoadPollingTimer);
		try{callback()}
		catch(e){kookie._scriptLoadPollingTimer = setTimeout(function(){kookie._scriptLoadPolling(callback)}, 50)}
	};

	//  configure
	kookie._configure = function()
	{
		var consent = kookie.getConsentCookie();

		if (typeof consent.allow == 'boolean')
		{
			return kookie._enterState(consent.allow ? kookie.state.HAS_CONSENT : kookie.state.NO_CONSENT);
		}
		else if ((kookie.config.countries || kookie.config.continents))
		{
			kookie.loadScript(
				kookie.config.geo.provider,
				kookie.config.geo.callback
			);
		}
		else //if (typeof consent.allow == 'boolean')
		{
			kookie._leaveState(kookie.state.CONFIG);
		}
	};

	//  state machine
	kookie._getStateListeners = function(state)
	{
		if (typeof kookie._stateListener == 'undefined')
			kookie._stateListener = [];
		if (typeof kookie._stateListener[state] == 'undefined')
			kookie._stateListener[state] = [];
		return kookie._stateListener[state];
	};
	kookie.addStateListener = function(state, callback)
	{
		var listener = kookie._getStateListeners(state);
		listener[listener.length] = callback;
	};
	kookie._leaveState = function(state)
	{
		switch (state)
		{
			case kookie.state.INIT:
			case kookie.state.CONFIG:
				kookie._enterState(state + 1);
				break;

			case kookie.state.READY:
			case kookie.state.OBTAINED_CONSENT:
			case kookie.state.REVOKED_CONSENT:
			case kookie.state.IMPLICIT_CONSENT:
			case kookie.state.HAS_CONSENT:
			case kookie.state.NO_CONSENT:
			case kookie.state.DO_NOT_TRACK:
			default:
				break;
		}
	};
	kookie._enterState = function(state)
	{
		kookie._currentState = state;
		switch (state)
		{
			case kookie.state.INIT:
			case kookie.state.CONFIG:
				break;

			case kookie.state.READY:
				var consent = kookie.getConsentCookie(),
				    require = false;

				switch(consent.allow)
				{
					case true: //  there is consent, the state is pushed towards HAS_CONSENT
						kookie._enterState(kookie.state.HAS_CONSENT);
						return;

					case false: //  there is NO consent, the state is pushed towards NO_CONSENT
						kookie._enterState(kookie.state.NO_CONSENT);
						return;

					default:
						// not all countries require the consent (even though it is good practise to ask everybody
						if (!require && kookie.config.countries)  require = (new RegExp('\\b' + kookie.geo.code + '\\b')).test(kookie.config.countries);
						if (!require && kookie.config.continents) require = (new RegExp('\\b' + kookie.geo.continent + '\\b')).test(kookie.config.continents);
						if (!require)
						{
							kookie._enterState(kookie.state.IMPLICIT_CONSENT);
							return;
						}
						break;
				}

				if (kookie.config.automaticallyAsk)
					kookie.askUserConsent();
				break;

			case kookie.state.OBTAINED_CONSENT:
			case kookie.state.REVOKED_CONSENT:
			case kookie.state.IMPLICIT_CONSENT:
			case kookie.state.HAS_CONSENT:
			case kookie.state.NO_CONSENT:
			case kookie.state.DO_NOT_TRACK:
			default:
				break;
		}


		kookie._currentState = state;
		kookie._triggerStateHandler(state);
	};
	kookie._triggerStateHandler = function(state)
	{
		var event = kookie._getStateName(state).replace(/[^A-Z]+/g, '').toLowerCase(),
		 listener = kookie._getStateListeners(state),
		        i;

		if (typeof listener != 'undefined')
			for (i = 0; i < listener.length; ++i)
				if (state == kookie._currentState)
					listener[i]();

		//  check for an assigned event and call it if it exists
		if (state == kookie._currentState)
		{
			if (typeof kookie['on' + event] == 'function')
				kookie['on' + event].call(kookie);
		}
	};

	//  cookie access
	kookie.getCookie = function(name)
	{
		var cookie = document.cookie.split(';'),
		     match = null,
		         i;
		for (i = 0; i < cookie.length; ++i)
		{
			match = cookie[i].match(new RegExp(name + '=(.*)', 'i'));
			if (match && match.length > 1)
				return match[1];
		}
		return '';
	};
	kookie.setCookie = function(name, value, lifetime, path, domain)
	{
		var expire = '';
		if (lifetime)
		{
			expire = new Date();
			expire.setDate(expire.getDate() + lifetime);
			expire = expire.toUTCString();
		}
		document.cookie = name + '=' + value + '; expires=' + expire + (path ? '; path=' + path : '') + (domain ? '; domain=' + domain : '');
	};
	kookie.getConsentCookie = function()
	{
		var value = kookie.getCookie(kookie.config.cookie.name),
		    match = value.match(/^(yes|no):([0-9]{13,})$/),
		     date = new Date();

		return {
			value:value,
			allow:(match && match.length > 1 ? match[1] == kookie.config.cookie.valueAllowed : null),
			date:(match && match.length > 2 && date.setTime(match[2]) ? date : null)
		};
	};
	kookie.setConsentCookie = function(doAllow)
	{
		var prevValue = kookie.getConsentCookie(),
		   hasChanged = typeof prevValue.allow != 'boolean' || prevValue.allow != doAllow;

		kookie.setCookie(
			kookie.config.cookie.name, 
			(doAllow ? kookie.config.cookie.valueAllowed : kookie.config.cookie.valueDeclined) + ':' + (new Date()).getTime(),
			kookie.config.cookie.lifetime,
			kookie.config.cookie.path,
			kookie.config.cookie.domain
		);

		if (hasChanged)
			kookie._enterState(doAllow ? kookie.state.OBTAINED_CONSENT : (prevValue.allow == true ? kookie.state.REVOKED_CONSENT : kookie.state.NO_CONSENT));
	};

	//  helpers
	kookie._doNotTrack = function()
	{
		var dnt = navigator.doNotTrack || navigator.msDoNotTrack || 'unspecified';
		if (/0|1/.test(dnt + '')) //  adjust the value to yes/no in case the preliminary spec was followed, thus setting the header values 0 (no) and 1 (yes)
			dnt = dnt == '1' ? 'yes' : 'no';
		return dnt == 'yes';
	};
	kookie._getStateName = function(state)
	{
		for (var p in kookie.state)
			if (kookie.state[p] == state)
				return p;
		return 'unknown';
	};
	kookie._mergeObjects = function(d, s)
	{
		for (var p in s)
			if (typeof d[p] != typeof s[p]) d[p] = s[p];
			else if (s[p] instanceof Object) d[p] = kookie._mergeObjects(d[p], s[p]);
		return d;
	};

	//  constants
	kookie.state = {INIT:0,CONFIG:1,READY:2,OBTAINED_CONSENT:3,REVOKED_CONSENT:4,IMPLICIT_CONSENT:5,HAS_CONSENT:6,NO_CONSENT:7,DO_NOT_TRACK:8};

	//  default configuration
	kookie.defaultConfig = {
		cookie:{
			name:'kookieConsent',
			lifetime:365,
			valueAllowed:'yes',
			valueDeclined:'no',
			domain:'.' + (window.location.host.split('.').splice(-2)).join('.'), //  the main domain
			path:'/'
		},
		automaticallyAsk:true,
		respectDoNotTrack:true,
		countries:[
			'AT',  //  Austria
			'BE',  //  Belgium
			'BG',  //  Bulgaria
			'CY',  //  Cyprus
			'CZ',  //  Czech Republic
			'DK',  //  Denmark
			'EE',  //  Estonia
			'FI',  //  Finland
			'FR',  //  France
			'DE',  //  Germany
			'GR',  //  Greece
			'HU',  //  Hungary
			'IE',  //  Ireland
			'IT',  //  Italy
			'LV',  //  Latvia
			'LT',  //  Lithuania
			'LU',  //  Luxembourg
			'MT',  //  Malta
			'NL',  //  Netherlands
			'PL',  //  Poland
			'PT',  //  Portugal
			'RO',  //  Romania
			'SK',  //  Slovakia
			'SI',  //  Slovenia
			'ES',  //  Spain
			'SE',  //  Sweden
			'GB',  //  United Kingdom
		].join(','),
		continents:false,
		geo:{
			provider:'http://konfirm.net/api/geo/summary.jsonp?callback=Kookie.setGeoLocation', 
		},
		style:{
			container:{position:'relative'},
			  explain:{display:'none'}
		},
		text:{
			question:'Do you want to allow non-essential cookies?',
			    more:'Read more',
			 explain:'As of the 26th of May 2012, all EU citizens must provide explicit consent to allow websites to use so called tracking-cookies. These cookies usually derive from other websites which integrate functionality into the website you are visiting.',
			 consent:'Yes, I allow this',
			 decline:'No, thank you'
		}
	};
})();

function kookie(config)
{
	document && document.body && document.head ? Kookie.init(config) : Kookie.delayInit(config);
};
