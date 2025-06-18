/**
 * Fast Grammar Analysis Service
 * Provides instant grammar, tense, articles, and usage analysis
 * Uses pre-built patterns and rules instead of heavy AI models
 */
export class FastGrammarService {
  constructor() {
    this.initializeGrammarPatterns();
    this.initializeWordDatabase();
    this.initializeArticleRules();
    this.initializeTensePatterns();
  }

  // Main analysis function - designed for speed (<100ms)
  analyzeText(text, language = 'de') {
    const startTime = Date.now();
    
    try {
      const words = this.tokenizeText(text);
      const analysis = {
        grammar: this.analyzeGrammar(words, language),
        tense: this.analyzeTense(words, language),
        articles: this.analyzeArticles(words, language),
        usage: this.analyzeUsage(text, language),
        words: this.analyzeWords(words, language)
      };

      const responseTime = Date.now() - startTime;
      console.log(`⚡ Fast grammar analysis completed in ${responseTime}ms`);
      
      return analysis;
    } catch (error) {
      console.error('Fast grammar analysis error:', error);
      return this.getFallbackAnalysis(text, language);
    }
  }

  tokenizeText(text) {
    return text.toLowerCase()
      .replace(/[.,!?;:]/g, '')
      .split(' ')
      .filter(word => word.length > 0);
  }

  analyzeGrammar(words, language) {
    if (language === 'de') {
      return this.analyzeGermanGrammar(words);
    } else {
      return this.analyzeEnglishGrammar(words);
    }
  }

  analyzeGermanGrammar(words) {
    const sentence = words.join(' ');
    
    // Question patterns
    if (this.germanPatterns.questions.some(pattern => sentence.includes(pattern))) {
      return "❓ Question sentence - uses question words (wer, was, wie, wo, wann) + verb + subject structure";
    }
    
    // Modal verbs
    const modalVerb = words.find(word => this.germanPatterns.modalVerbs.includes(word));
    if (modalVerb) {
      return `🎯 Modal verb sentence - "${modalVerb}" expresses ability, permission, or necessity. Structure: Subject + modal verb + infinitive at end`;
    }
    
    // Compound sentences
    if (this.germanPatterns.conjunctions.some(conj => words.includes(conj))) {
      return "🔗 Compound sentence - uses conjunction to connect clauses. Note: verb often moves to end in German subordinate clauses";
    }
    
    // Perfect tense
    if (words.includes('haben') || words.includes('sind') || words.includes('bin')) {
      const pastParticiple = words.find(word => word.endsWith('t') || word.endsWith('en'));
      if (pastParticiple) {
        return "⏰ Perfect tense - uses auxiliary verb (haben/sein) + past participle. Past participle usually goes to end of sentence";
      }
    }
    
    // Simple present
    return "📝 Simple sentence - Subject + Verb + Object structure. Verb in second position (V2 rule) in German main clauses";
  }

  analyzeEnglishGrammar(words) {
    const sentence = words.join(' ');
    
    // Question patterns
    if (words[0] && ['do', 'does', 'did', 'will', 'can', 'could', 'would', 'should'].includes(words[0])) {
      return "❓ Question sentence - auxiliary verb + subject + main verb structure";
    }
    
    // Conditional
    if (sentence.includes('would') || sentence.includes('could') || sentence.includes('should')) {
      return "🎯 Conditional sentence - expresses hypothetical situations or polite requests";
    }
    
    // Present continuous
    if (words.some(word => word.endsWith('ing')) && words.some(word => ['am', 'is', 'are'].includes(word))) {
      return "⏰ Present continuous - 'be' verb + '-ing' form expresses ongoing actions";
    }
    
    // Simple present
    return "📝 Simple sentence - Subject + Verb + Object structure. Basic English sentence pattern";
  }

  analyzeTense(words, language) {
    if (language === 'de') {
      return this.analyzeGermanTense(words);
    } else {
      return this.analyzeEnglishTense(words);
    }
  }

  analyzeGermanTense(words) {
    const sentence = words.join(' ');
    
    // Future with 'werden'
    if (words.includes('werde') || words.includes('werden') || words.includes('wird')) {
      return "🔮 Future tense (Futur I) - werden + infinitive. Used for future actions and predictions";
    }
    
    // Perfect tense
    if ((words.includes('haben') || words.includes('bin') || words.includes('sind')) && 
        words.some(word => word.endsWith('t') || word.endsWith('en'))) {
      return "✅ Perfect tense (Perfekt) - haben/sein + past participle. Used for completed actions with present relevance";
    }
    
    // Past tense (Präteritum) - common verbs
    const pastForms = ['war', 'hatte', 'ging', 'kam', 'sagte', 'machte', 'wollte', 'konnte'];
    if (words.some(word => pastForms.includes(word))) {
      return "📚 Past tense (Präteritum) - simple past form. Often used in written German and storytelling";
    }
    
    // Modal verbs (present)
    if (words.some(word => this.germanPatterns.modalVerbs.includes(word))) {
      return "🎯 Present tense with modal verb - expresses ability, permission, or necessity in present time";
    }
    
    return "⏰ Present tense (Präsens) - describes current actions, habits, and general truths";
  }

  analyzeEnglishTense(words) {
    // Future tense
    if (words.includes('will') || words.includes('going')) {
      return "🔮 Future tense - 'will' + base verb or 'going to' + base verb for future actions";
    }
    
    // Perfect tense
    if (words.includes('have') || words.includes('has')) {
      const pastParticiple = words.find(word => word.endsWith('ed') || this.irregularPastParticiples[word]);
      if (pastParticiple) {
        return "✅ Present perfect - have/has + past participle. Links past actions to present";
      }
    }
    
    // Past tense
    if (words.some(word => word.endsWith('ed') || this.irregularPastForms[word])) {
      return "📚 Past tense - describes completed actions in the past";
    }
    
    // Present continuous
    if (words.some(word => word.endsWith('ing')) && words.some(word => ['am', 'is', 'are'].includes(word))) {
      return "🔄 Present continuous - am/is/are + -ing form for ongoing actions";
    }
    
    return "⏰ Present simple - describes current actions, habits, and general truths";
  }

  analyzeArticles(words, language) {
    if (language === 'de') {
      return this.analyzeGermanArticles(words);
    } else {
      return this.analyzeEnglishArticles(words);
    }
  }

  analyzeGermanArticles(words) {
    const articles = words.filter(word => this.germanArticles.definite.includes(word) || 
                                         this.germanArticles.indefinite.includes(word));
    
    if (articles.length === 0) {
      return "ℹ️ No articles found - some German nouns can be used without articles in certain contexts";
    }
    
    const explanations = articles.map(article => {
      const articleInfo = this.getGermanArticleInfo(article);
      return `${article} → ${articleInfo}`;
    });
    
    return `📚 German articles found:\n${explanations.join('\n')}\n\n💡 Tip: German articles change based on case (Nominativ, Akkusativ, Dativ, Genitiv)`;
  }

  analyzeEnglishArticles(words) {
    const articles = words.filter(word => ['the', 'a', 'an'].includes(word));
    
    if (articles.length === 0) {
      return "ℹ️ No articles found in this sentence";
    }
    
    const articleCount = {
      'the': words.filter(w => w === 'the').length,
      'a': words.filter(w => w === 'a').length,
      'an': words.filter(w => w === 'an').length
    };
    
    let explanation = "📚 English articles:\n";
    if (articleCount.the > 0) explanation += `• "the" (${articleCount.the}x) - definite article for specific things\n`;
    if (articleCount.a > 0) explanation += `• "a" (${articleCount.a}x) - indefinite article before consonant sounds\n`;
    if (articleCount.an > 0) explanation += `• "an" (${articleCount.an}x) - indefinite article before vowel sounds\n`;
    
    return explanation;
  }

  analyzeUsage(text, language) {
    const lowerText = text.toLowerCase();
    
    if (language === 'de') {
      return this.analyzeGermanUsage(lowerText);
    } else {
      return this.analyzeEnglishUsage(lowerText);
    }
  }

  analyzeGermanUsage(text) {
    // Politeness patterns
    if (text.includes('bitte') || text.includes('möchte') || text.includes('könnten')) {
      return "🎩 Polite expression - uses polite words like 'bitte', 'möchte', or conditional forms. Perfect for formal situations";
    }
    
    // Greetings
    if (text.includes('hallo') || text.includes('guten') || text.includes('auf wiedersehen')) {
      return "👋 Greeting/farewell - standard German social expressions. Use 'Sie' form in formal contexts";
    }
    
    // Questions
    if (text.includes('wie') || text.includes('was') || text.includes('wo') || text.includes('wann')) {
      return "❓ Information question - uses W-questions (wie, was, wo, wann, warum, wer). Verb comes second in German questions";
    }
    
    // Common phrases
    if (text.includes('ich brauche') || text.includes('ich möchte')) {
      return "🛍️ Need/want expression - common for shopping, ordering, or requesting. Very useful in everyday situations";
    }
    
    return "💬 General conversation - standard German expression suitable for everyday communication";
  }

  analyzeEnglishUsage(text) {
    // Politeness
    if (text.includes('please') || text.includes('would') || text.includes('could')) {
      return "🎩 Polite expression - uses polite words and forms. Shows courtesy and respect";
    }
    
    // Greetings
    if (text.includes('hello') || text.includes('good') || text.includes('goodbye')) {
      return "👋 Greeting/farewell - standard English social expressions for meeting and parting";
    }
    
    // Questions
    if (text.includes('what') || text.includes('how') || text.includes('where') || text.includes('when')) {
      return "❓ Information question - uses WH-questions to gather specific information";
    }
    
    // Common needs
    if (text.includes('i need') || text.includes('i want') || text.includes('i would like')) {
      return "🛍️ Need/want expression - useful for shopping, ordering, or making requests";
    }
    
    return "💬 General conversation - standard English expression for everyday communication";
  }

  analyzeWords(words, language) {
    return words.slice(0, 8).map(word => { // Limit to 8 words for speed
      const info = this.getWordInfo(word, language);
      return {
        word: word,
        type: info.type,
        meaning: info.meaning,
        note: info.note
      };
    });
  }

  getWordInfo(word, language) {
    const cleanWord = word.toLowerCase().replace(/[.,!?;:]/g, '');
    
    if (language === 'de') {
      return this.getGermanWordInfo(cleanWord);
    } else {
      return this.getEnglishWordInfo(cleanWord);
    }
  }

  getGermanWordInfo(word) {
    // Check word database
    if (this.germanWordDB[word]) {
      return this.germanWordDB[word];
    }
    
    // Pattern matching for unknown words
    if (word.endsWith('ung')) {
      return { type: 'noun (f)', meaning: 'unknown', note: 'feminine noun ending in -ung' };
    }
    if (word.endsWith('keit') || word.endsWith('heit')) {
      return { type: 'noun (f)', meaning: 'unknown', note: 'feminine noun ending' };
    }
    if (word.endsWith('er') && word.length > 4) {
      return { type: 'noun (m)', meaning: 'unknown', note: 'likely masculine noun (person/tool)' };
    }
    if (word.endsWith('en')) {
      return { type: 'verb/noun', meaning: 'unknown', note: 'could be infinitive verb or plural noun' };
    }
    
    return { type: 'unknown', meaning: 'unknown', note: 'word not in database' };
  }

  getEnglishWordInfo(word) {
    if (this.englishWordDB[word]) {
      return this.englishWordDB[word];
    }
    
    // Pattern matching
    if (word.endsWith('ing')) {
      return { type: 'verb/adjective', meaning: 'unknown', note: '-ing form (progressive/gerund)' };
    }
    if (word.endsWith('ed')) {
      return { type: 'verb', meaning: 'unknown', note: 'past tense/past participle' };
    }
    if (word.endsWith('ly')) {
      return { type: 'adverb', meaning: 'unknown', note: 'adverb ending in -ly' };
    }
    
    return { type: 'unknown', meaning: 'unknown', note: 'word not in database' };
  }

  getGermanArticleInfo(article) {
    const articleMap = {
      'der': 'masculine nominative/dative',
      'die': 'feminine nominative/accusative OR plural',
      'das': 'neuter nominative/accusative',
      'den': 'masculine accusative OR plural dative',
      'dem': 'masculine/neuter dative',
      'des': 'masculine/neuter genitive',
      'ein': 'indefinite masculine/neuter',
      'eine': 'indefinite feminine',
      'einen': 'indefinite masculine accusative',
      'einem': 'indefinite masculine/neuter dative',
      'einer': 'indefinite feminine dative/genitive'
    };
    
    return articleMap[article] || 'unknown article form';
  }

  getFallbackAnalysis(text, language) {
    return {
      grammar: "📝 Basic sentence structure - subject and predicate present",
      tense: "⏰ Present context - expressing current or general information",
      articles: "📚 Standard article usage for the language",
      usage: "💬 General conversational expression",
      words: text.split(' ').slice(0, 5).map(word => ({
        word: word,
        type: 'word',
        meaning: 'meaning available',
        note: 'basic word'
      }))
    };
  }

  initializeGrammarPatterns() {
    this.germanPatterns = {
      questions: ['wie', 'was', 'wo', 'wann', 'warum', 'wer', 'welch'],
      modalVerbs: ['kann', 'könnte', 'muss', 'müssen', 'will', 'wollen', 'soll', 'sollte', 'darf', 'möchte', 'mag'],
      conjunctions: ['und', 'oder', 'aber', 'denn', 'weil', 'dass', 'wenn', 'als', 'bevor', 'nachdem']
    };
    
    this.englishPatterns = {
      questions: ['what', 'how', 'where', 'when', 'why', 'who', 'which'],
      modalVerbs: ['can', 'could', 'may', 'might', 'must', 'should', 'will', 'would'],
      conjunctions: ['and', 'or', 'but', 'because', 'if', 'when', 'that', 'while', 'although']
    };
  }

  initializeWordDatabase() {
    // German word database - common words for quick lookup
    this.germanWordDB = {
      'ich': { type: 'pronoun', meaning: 'I', note: 'first person singular' },
      'du': { type: 'pronoun', meaning: 'you (informal)', note: 'second person singular' },
      'er': { type: 'pronoun', meaning: 'he', note: 'third person masculine' },
      'sie': { type: 'pronoun', meaning: 'she/they/you (formal)', note: 'context dependent' },
      'es': { type: 'pronoun', meaning: 'it', note: 'third person neuter' },
      'bin': { type: 'verb', meaning: 'am', note: 'first person "sein" (to be)' },
      'ist': { type: 'verb', meaning: 'is', note: 'third person "sein" (to be)' },
      'sind': { type: 'verb', meaning: 'are', note: 'plural "sein" (to be)' },
      'haben': { type: 'verb', meaning: 'to have', note: 'infinitive form' },
      'habe': { type: 'verb', meaning: 'have', note: 'first person "haben"' },
      'hat': { type: 'verb', meaning: 'has', note: 'third person "haben"' },
      'möchte': { type: 'verb', meaning: 'would like', note: 'polite form of "mögen"' },
      'kann': { type: 'modal verb', meaning: 'can', note: 'ability or permission' },
      'muss': { type: 'modal verb', meaning: 'must', note: 'necessity or obligation' },
      'will': { type: 'modal verb', meaning: 'want to', note: 'intention or desire' },
      'einen': { type: 'article', meaning: 'a/an', note: 'indefinite masculine accusative' },
      'eine': { type: 'article', meaning: 'a/an', note: 'indefinite feminine' },
      'ein': { type: 'article', meaning: 'a/an', note: 'indefinite masculine/neuter' },
      'der': { type: 'article', meaning: 'the', note: 'definite masculine nominative' },
      'die': { type: 'article', meaning: 'the', note: 'definite feminine/plural' },
      'das': { type: 'article', meaning: 'the', note: 'definite neuter' },
      'und': { type: 'conjunction', meaning: 'and', note: 'connects words/phrases' },
      'oder': { type: 'conjunction', meaning: 'or', note: 'shows alternatives' },
      'aber': { type: 'conjunction', meaning: 'but', note: 'shows contrast' },
      'mit': { type: 'preposition', meaning: 'with', note: 'requires dative case' },
      'in': { type: 'preposition', meaning: 'in', note: 'location (dative/accusative)' },
      'zu': { type: 'preposition', meaning: 'to', note: 'direction (dative)' },
      'für': { type: 'preposition', meaning: 'for', note: 'requires accusative case' },
      'von': { type: 'preposition', meaning: 'from/of', note: 'requires dative case' },
      'auf': { type: 'preposition', meaning: 'on', note: 'location/direction' },
      'aus': { type: 'preposition', meaning: 'from/out of', note: 'requires dative case' },
      'bei': { type: 'preposition', meaning: 'at/near', note: 'requires dative case' },
      'nach': { type: 'preposition', meaning: 'after/to', note: 'time/direction (dative)' },
      'vor': { type: 'preposition', meaning: 'before/in front of', note: 'time/location' },
      'über': { type: 'preposition', meaning: 'over/about', note: 'location/topic' },
      'unter': { type: 'preposition', meaning: 'under/among', note: 'location/group' },
      'zwischen': { type: 'preposition', meaning: 'between', note: 'requires dative case' },
      'hallo': { type: 'interjection', meaning: 'hello', note: 'informal greeting' },
      'guten': { type: 'adjective', meaning: 'good', note: 'used in greetings' },
      'danke': { type: 'interjection', meaning: 'thank you', note: 'expression of gratitude' },
      'bitte': { type: 'interjection', meaning: 'please/you\'re welcome', note: 'politeness word' },
      'ja': { type: 'adverb', meaning: 'yes', note: 'affirmative response' },
      'nein': { type: 'adverb', meaning: 'no', note: 'negative response' },
      'nicht': { type: 'adverb', meaning: 'not', note: 'negation particle' },
      'kein': { type: 'determiner', meaning: 'no/not a', note: 'negative article' },
      'alle': { type: 'determiner', meaning: 'all', note: 'refers to entirety' },
      'viele': { type: 'determiner', meaning: 'many', note: 'large quantity' },
      'wenige': { type: 'determiner', meaning: 'few', note: 'small quantity' },
      'heute': { type: 'adverb', meaning: 'today', note: 'time reference' },
      'morgen': { type: 'adverb', meaning: 'tomorrow', note: 'time reference' },
      'gestern': { type: 'adverb', meaning: 'yesterday', note: 'time reference' },
      'jetzt': { type: 'adverb', meaning: 'now', note: 'present time' },
      'hier': { type: 'adverb', meaning: 'here', note: 'location reference' },
      'dort': { type: 'adverb', meaning: 'there', note: 'location reference' },
      'wie': { type: 'adverb', meaning: 'how', note: 'question word' },
      'was': { type: 'pronoun', meaning: 'what', note: 'question word' },
      'wo': { type: 'adverb', meaning: 'where', note: 'question word' },
      'wann': { type: 'adverb', meaning: 'when', note: 'question word' },
      'warum': { type: 'adverb', meaning: 'why', note: 'question word' },
      'wer': { type: 'pronoun', meaning: 'who', note: 'question word' }
    };
    
    // English word database
    this.englishWordDB = {
      'i': { type: 'pronoun', meaning: 'I', note: 'first person singular' },
      'you': { type: 'pronoun', meaning: 'you', note: 'second person' },
      'he': { type: 'pronoun', meaning: 'he', note: 'third person masculine' },
      'she': { type: 'pronoun', meaning: 'she', note: 'third person feminine' },
      'it': { type: 'pronoun', meaning: 'it', note: 'third person neuter' },
      'we': { type: 'pronoun', meaning: 'we', note: 'first person plural' },
      'they': { type: 'pronoun', meaning: 'they', note: 'third person plural' },
      'am': { type: 'verb', meaning: 'am', note: 'first person "to be"' },
      'is': { type: 'verb', meaning: 'is', note: 'third person "to be"' },
      'are': { type: 'verb', meaning: 'are', note: 'second/plural "to be"' },
      'have': { type: 'verb', meaning: 'have', note: 'possession/auxiliary' },
      'has': { type: 'verb', meaning: 'has', note: 'third person "have"' },
      'do': { type: 'verb', meaning: 'do', note: 'action/auxiliary verb' },
      'does': { type: 'verb', meaning: 'does', note: 'third person "do"' },
      'will': { type: 'modal verb', meaning: 'will', note: 'future auxiliary' },
      'would': { type: 'modal verb', meaning: 'would', note: 'conditional auxiliary' },
      'can': { type: 'modal verb', meaning: 'can', note: 'ability/permission' },
      'could': { type: 'modal verb', meaning: 'could', note: 'past ability/polite' },
      'should': { type: 'modal verb', meaning: 'should', note: 'advice/obligation' },
      'must': { type: 'modal verb', meaning: 'must', note: 'necessity/strong obligation' },
      'the': { type: 'article', meaning: 'the', note: 'definite article' },
      'a': { type: 'article', meaning: 'a', note: 'indefinite article' },
      'an': { type: 'article', meaning: 'an', note: 'indefinite article (vowel)' },
      'and': { type: 'conjunction', meaning: 'and', note: 'connects items' },
      'or': { type: 'conjunction', meaning: 'or', note: 'shows alternatives' },
      'but': { type: 'conjunction', meaning: 'but', note: 'shows contrast' },
      'in': { type: 'preposition', meaning: 'in', note: 'location/time' },
      'on': { type: 'preposition', meaning: 'on', note: 'surface/contact' },
      'at': { type: 'preposition', meaning: 'at', note: 'specific location/time' },
      'to': { type: 'preposition', meaning: 'to', note: 'direction/purpose' },
      'for': { type: 'preposition', meaning: 'for', note: 'purpose/recipient' },
      'with': { type: 'preposition', meaning: 'with', note: 'accompaniment/tool' },
      'by': { type: 'preposition', meaning: 'by', note: 'method/agent' },
      'from': { type: 'preposition', meaning: 'from', note: 'origin/source' },
      'hello': { type: 'interjection', meaning: 'hello', note: 'greeting' },
      'thank': { type: 'verb', meaning: 'thank', note: 'express gratitude' },
      'please': { type: 'adverb', meaning: 'please', note: 'polite request' },
      'yes': { type: 'adverb', meaning: 'yes', note: 'affirmative response' },
      'no': { type: 'adverb', meaning: 'no', note: 'negative response' },
      'not': { type: 'adverb', meaning: 'not', note: 'negation' },
      'very': { type: 'adverb', meaning: 'very', note: 'intensifier' },
      'today': { type: 'adverb', meaning: 'today', note: 'current day' },
      'tomorrow': { type: 'adverb', meaning: 'tomorrow', note: 'next day' },
      'yesterday': { type: 'adverb', meaning: 'yesterday', note: 'previous day' },
      'now': { type: 'adverb', meaning: 'now', note: 'current time' },
      'here': { type: 'adverb', meaning: 'here', note: 'this location' },
      'there': { type: 'adverb', meaning: 'there', note: 'that location' },
      'what': { type: 'pronoun', meaning: 'what', note: 'question word' },
      'how': { type: 'adverb', meaning: 'how', note: 'question word' },
      'where': { type: 'adverb', meaning: 'where', note: 'question word' },
      'when': { type: 'adverb', meaning: 'when', note: 'question word' },
      'why': { type: 'adverb', meaning: 'why', note: 'question word' },
      'who': { type: 'pronoun', meaning: 'who', note: 'question word' }
    };
    
    // Irregular verb forms for English
    this.irregularPastForms = {
      'went': 'go', 'came': 'come', 'saw': 'see', 'said': 'say', 'got': 'get',
      'made': 'make', 'took': 'take', 'gave': 'give', 'found': 'find', 'thought': 'think'
    };
    
    this.irregularPastParticiples = {
      'gone': 'go', 'come': 'come', 'seen': 'see', 'said': 'say', 'gotten': 'get',
      'made': 'make', 'taken': 'take', 'given': 'give', 'found': 'find', 'thought': 'think'
    };
  }

  initializeArticleRules() {
    this.germanArticles = {
      definite: ['der', 'die', 'das', 'den', 'dem', 'des'],
      indefinite: ['ein', 'eine', 'einen', 'einem', 'einer']
    };
  }

  initializeTensePatterns() {
    // Patterns are already handled in the analyze methods
    console.log('✅ Tense patterns initialized');
  }
}
