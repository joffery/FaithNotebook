export type BibleVerse = {
  verse: number;
  text: string;
};

export type BibleChapter = {
  book: string;
  chapter: number;
  verses: BibleVerse[];
};

export const bibleChapters: Record<string, BibleChapter> = {
  'John-14': {
    book: 'John',
    chapter: 14,
    verses: [
      { verse: 1, text: 'Do not let your hearts be troubled. You believe in God; believe also in me.' },
      { verse: 2, text: 'My Father\'s house has many rooms; if that were not so, would I have told you that I am going there to prepare a place for you?' },
      { verse: 3, text: 'And if I go and prepare a place for you, I will come back and take you to be with me that you also may be where I am.' },
      { verse: 4, text: 'You know the way to the place where I am going.' },
      { verse: 5, text: 'Thomas said to him, "Lord, we don\'t know where you are going, so how can we know the way?"' },
      { verse: 6, text: 'Jesus answered, "I am the way and the truth and the life. No one comes to the Father except through me.' },
      { verse: 7, text: 'If you really know me, you will know my Father as well. From now on, you do know him and have seen him."' },
      { verse: 8, text: 'Philip said, "Lord, show us the Father and that will be enough for us."' },
      { verse: 9, text: 'Jesus answered: "Don\'t you know me, Philip, even after I have been among you such a long time? Anyone who has seen me has seen the Father. How can you say, \'Show us the Father\'?' },
      { verse: 10, text: 'Don\'t you believe that I am in the Father, and that the Father is in me? The words I say to you I do not speak on my own authority. Rather, it is the Father, living in me, who is doing his work.' },
      { verse: 11, text: 'Believe me when I say that I am in the Father and the Father is in me; or at least believe on the evidence of the works themselves.' },
      { verse: 12, text: 'Very truly I tell you, whoever believes in me will do the works I have been doing, and they will do even greater things than these, because I am going to the Father.' },
      { verse: 13, text: 'And I will do whatever you ask in my name, so that the Father may be glorified in the Son.' },
      { verse: 14, text: 'You may ask me for anything in my name, and I will do it.' },
      { verse: 15, text: 'If you love me, keep my commands.' },
      { verse: 16, text: 'And I will ask the Father, and he will give you another advocate to help you and be with you forever—' },
      { verse: 17, text: 'the Spirit of truth. The world cannot accept him, because it neither sees him nor knows him. But you know him, for he lives with you and will be in you.' },
      { verse: 18, text: 'I will not leave you as orphans; I will come to you.' },
      { verse: 19, text: 'Before long, the world will not see me anymore, but you will see me. Because I live, you also will live.' },
      { verse: 20, text: 'On that day you will realize that I am in my Father, and you are in me, and I am in you.' },
      { verse: 21, text: 'Whoever has my commands and keeps them is the one who loves me. The one who loves me will be loved by my Father, and I too will love them and show myself to them.' },
      { verse: 22, text: 'Then Judas (not Judas Iscariot) said, "But, Lord, why do you intend to show yourself to us and not to the world?"' },
      { verse: 23, text: 'Jesus replied, "Anyone who loves me will obey my teaching. My Father will love them, and we will come to them and make our home with them.' },
      { verse: 24, text: 'Anyone who does not love me will not obey my teaching. These words you hear are not my own; they belong to the Father who sent me.' },
      { verse: 25, text: 'All this I have spoken while still with you.' },
      { verse: 26, text: 'But the Advocate, the Holy Spirit, whom the Father will send in my name, will teach you all things and will remind you of everything I have said to you.' },
      { verse: 27, text: 'Peace I leave with you; my peace I give you. I do not give to you as the world gives. Do not let your hearts be troubled and do not be afraid.' },
      { verse: 28, text: 'You heard me say, "I am going away and I am coming back to you." If you loved me, you would be glad that I am going to the Father, for the Father is greater than I.' },
      { verse: 29, text: 'I have told you now before it happens, so that when it does happen you will believe.' },
      { verse: 30, text: 'I will not say much more to you, for the prince of this world is coming. He has no hold over me,' },
      { verse: 31, text: 'but he comes so that the world may learn that I love the Father and do exactly what my Father has commanded me. Come now; let us leave.' },
    ],
  },
  'Matthew-6': {
    book: 'Matthew',
    chapter: 6,
    verses: [
      { verse: 1, text: 'Be careful not to practice your righteousness in front of others to be seen by them. If you do, you will have no reward from your Father in heaven.' },
      { verse: 2, text: 'So when you give to the needy, do not announce it with trumpets, as the hypocrites do in the synagogues and on the streets, to be honored by others. Truly I tell you, they have received their reward in full.' },
      { verse: 3, text: 'But when you give to the needy, do not let your left hand know what your right hand is doing,' },
      { verse: 4, text: 'so that your giving may be in secret. Then your Father, who sees what is done in secret, will reward you.' },
      { verse: 5, text: 'And when you pray, do not be like the hypocrites, for they love to pray standing in the synagogues and on the street corners to be seen by others. Truly I tell you, they have received their reward in full.' },
      { verse: 6, text: 'But when you pray, go into your room, close the door and pray to your Father, who is unseen. Then your Father, who sees what is done in secret, will reward you.' },
      { verse: 7, text: 'And when you pray, do not keep on babbling like pagans, for they think they will be heard because of their many words.' },
      { verse: 8, text: 'Do not be like them, for your Father knows what you need before you ask him.' },
      { verse: 9, text: 'This, then, is how you should pray: "Our Father in heaven, hallowed be your name,' },
      { verse: 10, text: 'your kingdom come, your will be done, on earth as it is in heaven.' },
      { verse: 11, text: 'Give us today our daily bread.' },
      { verse: 12, text: 'And forgive us our debts, as we also have forgiven our debtors.' },
      { verse: 13, text: 'And lead us not into temptation, but deliver us from the evil one."' },
      { verse: 14, text: 'For if you forgive other people when they sin against you, your heavenly Father will also forgive you.' },
      { verse: 15, text: 'But if you do not forgive others their sins, your Father will not forgive your sins.' },
      { verse: 16, text: 'When you fast, do not look somber as the hypocrites do, for they disfigure their faces to show others they are fasting. Truly I tell you, they have received their reward in full.' },
      { verse: 17, text: 'But when you fast, put oil on your head and wash your face,' },
      { verse: 18, text: 'so that it will not be obvious to others that you are fasting, but only to your Father, who is unseen; and your Father, who sees what is done in secret, will reward you.' },
      { verse: 19, text: 'Do not store up for yourselves treasures on earth, where moths and vermin destroy, and where thieves break in and steal.' },
      { verse: 20, text: 'But store up for yourselves treasures in heaven, where moths and vermin do not destroy, and where thieves do not break in and steal.' },
      { verse: 21, text: 'For where your treasure is, there your heart will be also.' },
      { verse: 22, text: 'The eye is the lamp of the body. If your eyes are healthy, your whole body will be full of light.' },
      { verse: 23, text: 'But if your eyes are unhealthy, your whole body will be full of darkness. If then the light within you is darkness, how great is that darkness!' },
      { verse: 24, text: 'No one can serve two masters. Either you will hate the one and love the other, or you will be devoted to the one and despise the other. You cannot serve both God and money.' },
      { verse: 25, text: 'Therefore I tell you, do not worry about your life, what you will eat or drink; or about your body, what you will wear. Is not life more than food, and the body more than clothes?' },
      { verse: 26, text: 'Look at the birds of the air; they do not sow or reap or store away in barns, and yet your heavenly Father feeds them. Are you not much more valuable than they?' },
      { verse: 27, text: 'Can any one of you by worrying add a single hour to your life?' },
      { verse: 28, text: 'And why do you worry about clothes? See how the flowers of the field grow. They do not labor or spin.' },
      { verse: 29, text: 'Yet I tell you that not even Solomon in all his splendor was dressed like one of these.' },
      { verse: 30, text: 'If that is how God clothes the grass of the field, which is here today and tomorrow is thrown into the fire, will he not much more clothe you—you of little faith?' },
      { verse: 31, text: 'So do not worry, saying, "What shall we eat?" or "What shall we drink?" or "What shall we wear?"' },
      { verse: 32, text: 'For the pagans run after all these things, and your heavenly Father knows that you need them.' },
      { verse: 33, text: 'But seek first his kingdom and his righteousness, and all these things will be given to you as well.' },
      { verse: 34, text: 'Therefore do not worry about tomorrow, for tomorrow will worry about itself. Each day has enough trouble of its own.' },
    ],
  },
};

export function getBibleChapter(book: string, chapter: number): BibleChapter | null {
  const key = `${book}-${chapter}`;
  return bibleChapters[key] || null;
}
